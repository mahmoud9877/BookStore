import { LOAN_POPULATE } from "./loan.repository.js";
import { LoanResponseDto } from "./circulation.dto.js";
import { LOAN_STATUSES, RESERVATION_STATUSES } from "./circulation-statuses.js";
import { COPY_STATUSES } from "../copies/copy-statuses.js";
import { MemberPolicy } from "../members/member-policy.js";
import { overdueFine, lostItemFee } from "../finance/fine-policy.js";
import { pageOf, toSort } from "../../core/pagination.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ensureFound } from "../../core/http-errors.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const S = COPY_STATUSES;
const R = RESERVATION_STATUSES;

/**
 * The circulation desk: check out, return, renew, declare lost. Every workflow
 * runs in one transaction; copy and loan changes are guarded (conditional
 * updates + a unique index on active loans), so two desks can never lend the
 * same copy or exceed a member's limit at the same time.
 */
export class CirculationService {
  #loans;
  #copies;
  #members;
  #reservations;
  #fines;
  #settings;
  #allocator;
  #transactions;
  #audit;

  constructor({ loanRepository, copyRepository, memberRepository, reservationRepository, fineService, settingsService, copyAllocator, transactionRunner, auditService }) {
    this.#loans = loanRepository;
    this.#copies = copyRepository;
    this.#members = memberRepository;
    this.#reservations = reservationRepository;
    this.#fines = fineService;
    this.#settings = settingsService;
    this.#allocator = copyAllocator;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  /**
   * Lends a copy (by barcode) to a member (by id or number).
   * `overrideReason` lets staff lend beyond the loan limit or balance block; it
   * never overrides a suspended or expired membership, and it is audited.
   * @param {import("./circulation.dto.js").CheckoutDto} dto
   */
  async checkout({ barcode, member: memberRef, overrideReason }, actor) {
    const copy = ensureFound(await this.#copies.findByBarcode(barcode), "No copy has this barcode");
    // A held copy sits at the reservation's pickup branch, which may not be its own.
    const hold = copy.status === S.onHold ? await this.#reservations.findById(copy.reservation) : null;
    const branchId = hold?.pickupBranch ?? copy.branch._id;
    actor.assertBranch(branchId, "Copies can only be lent at the desk of the branch where they are");
    const member = await this.#findMember(memberRef);
    MemberPolicy.assertInGoodStanding(member);

    const loan = await this.#transactions.run(async () => {
      // Touching the member serialises concurrent checkouts for the same member,
      // so the limit check below cannot be raced.
      await this.#members.updateWhere({ _id: member._id }, { $inc: { circulationVersion: 1 } });
      const blocks = await this.#limitBlocks(member);
      if (blocks.length && !overrideReason) throw new ForbiddenError(blocks.join(". "));

      const reservation = await this.#claimCopy(copy, member);
      const now = new Date();
      const created = await this.#loans.create({
        copy: copy._id,
        book: copy.book._id,
        member: member._id,
        branch: branchId,
        checkedOutAt: now,
        dueAt: new Date(now.getTime() + member.membershipType.loanPeriodDays * DAY_MS),
        checkedOutBy: actor.userId,
        overrideReason: blocks.length ? overrideReason : undefined,
      });
      if (reservation) {
        await this.#reservations.transition(reservation._id, [R.ready, R.waiting], R.fulfilled, { closedAt: now });
      }
      await this.#audit.record(actor, {
        action: blocks.length ? "loan.checkout_override" : "loan.checkout",
        entity: "Loan",
        entityId: created._id,
        branch: branchId,
        after: { barcode: copy.barcode, member: member.memberNumber, dueAt: created.dueAt, overriddenBlocks: blocks.length ? blocks : undefined },
        reason: blocks.length ? overrideReason : undefined,
      });
      return created;
    });
    return this.getLoan(loan._id);
  }

  /**
   * Takes a copy back at `branch` (default: the copy's branch). Charges any
   * overdue fine, then hands the copy to the next reservation, sends it home,
   * or shelves it. A damaged return is charged and kept out of circulation.
   * @param {import("./circulation.dto.js").ReturnDto} dto
   */
  async checkin({ barcode, branch, damaged, notes }, actor) {
    const copy = ensureFound(await this.#copies.findByBarcode(barcode), "No copy has this barcode");
    const returnBranch = branch ?? String(copy.branch._id);
    actor.assertBranch(returnBranch, "You can only take returns at your own branch");
    const loan = await this.#loans.findActiveByCopy(copy._id);
    if (!loan) throw new BadRequestError("This copy is not on loan");
    const settings = await this.#settings.get();

    const outcome = await this.#transactions.run(async () => {
      const returnedAt = new Date();
      const closed = await this.#loans.close(loan._id, LOAN_STATUSES.returned, {
        returnedAt, returnBranch, returnedBy: actor.userId, returnNotes: notes,
      });
      if (!closed) throw new ConflictError("This loan was already closed");
      const member = await this.#members.findById(loan.member);
      const plainCopy = { ...copy, book: copy.book._id, branch: copy.branch._id };

      const fineAmount = overdueFine({ dueAt: loan.dueAt, returnedAt }, settings.fines);
      await this.#fines.chargeForLoan({ member, loan, copy: plainCopy, branch: returnBranch, type: "overdue", amount: fineAmount, reason: "Returned late" }, actor);

      let next;
      if (damaged) {
        await this.#fines.chargeForLoan({ member, loan, copy: plainCopy, branch: returnBranch, type: "damaged", amount: settings.fines.damagedItemFee, reason: notes || "Returned damaged" }, actor);
        const moved = await this.#copies.transition(copy._id, S.onLoan, S.damaged, { condition: "poor" });
        if (!moved) throw new ConflictError("The copy changed meanwhile. Please retry.");
        next = "damaged";
      } else {
        next = await this.#allocator.release(plainCopy, returnBranch, actor);
      }
      await this.#audit.record(actor, {
        action: "loan.return", entity: "Loan", entityId: loan._id, branch: returnBranch,
        after: { barcode: copy.barcode, returnedAt, overdueFine: fineAmount, damaged: Boolean(damaged), next },
      });
      return { next, fine: fineAmount };
    });
    return { loan: await this.getLoan(loan._id), ...outcome };
  }

  /**
   * Extends a loan by the member's loan period, if renewals remain, the loan
   * is not overdue and nobody is waiting for the title (unless settings allow).
   * Members may renew their own loans; staff any loan of their branches.
   */
  async renew({ id }, actor, { asMemberUserId } = {}) {
    const loan = ensureFound(await this.#loans.findById(id), "Loan not found");
    if (loan.status !== LOAN_STATUSES.active) throw new BadRequestError("Only active loans can be renewed");
    const member = ensureFound(await this.#members.findWithType(loan.member), "Member not found");
    if (asMemberUserId) {
      if (String(member.user) !== String(asMemberUserId)) throw new NotFoundError("Loan not found");
    } else {
      actor.assertBranch(loan.branch);
    }
    MemberPolicy.assertInGoodStanding(member);
    const settings = await this.#settings.get();
    const now = new Date();
    if (new Date(loan.dueAt) < now) throw new BadRequestError("Overdue loans cannot be renewed. Please return the item.");
    if (loan.renewals >= member.membershipType.maxRenewals) {
      throw new BadRequestError(`The renewal limit (${member.membershipType.maxRenewals}) has been reached`);
    }
    if (!settings.circulation.allowRenewalWhenReserved && (await this.#reservations.countWaiting(loan.book))) {
      throw new BadRequestError("Other members are waiting for this title, so it cannot be renewed");
    }
    const dueAt = new Date(now.getTime() + member.membershipType.loanPeriodDays * DAY_MS);
    const renewed = await this.#transactions.run(async () => {
      const updated = await this.#loans.renew(id, loan.renewals, dueAt);
      if (!updated) throw new ConflictError("The loan changed meanwhile. Reload and try again.");
      await this.#audit.record(asMemberUserId ? { userId: asMemberUserId, userName: member.name } : actor, {
        action: "loan.renew", entity: "Loan", entityId: id, branch: loan.branch,
        before: { dueAt: loan.dueAt, renewals: loan.renewals }, after: { dueAt, renewals: updated.renewals },
      });
      return updated;
    });
    return this.getLoan(renewed._id);
  }

  /** Closes a loan whose copy is lost and charges the replacement fee. */
  async declareLost({ id, reason }, actor) {
    const loan = ensureFound(await this.#loans.findById(id), "Loan not found");
    actor.assertBranch(loan.branch);
    if (loan.status !== LOAN_STATUSES.active) throw new BadRequestError("Only active loans can be declared lost");
    const settings = await this.#settings.get();
    await this.#transactions.run(async () => {
      const closed = await this.#loans.close(id, LOAN_STATUSES.lost, { returnedAt: new Date(), returnedBy: actor.userId, returnNotes: reason });
      if (!closed) throw new ConflictError("This loan was already closed");
      const copy = await this.#copies.transition(loan.copy, S.onLoan, S.lost);
      if (!copy) throw new ConflictError("The copy changed meanwhile. Please retry.");
      const member = await this.#members.findById(loan.member);
      const amount = lostItemFee(copy, settings.fines);
      await this.#fines.chargeForLoan({ member, loan, copy, branch: loan.branch, type: "lost", amount, reason: reason || "Item lost" }, actor);
      await this.#audit.record(actor, { action: "loan.lost", entity: "Loan", entityId: id, branch: loan.branch, after: { copy: copy.barcode, fee: amount }, reason });
    });
    return this.getLoan(id);
  }

  async getLoan(id) {
    return LoanResponseDto.from(ensureFound(await this.#loans.findById(id, { populate: LOAN_POPULATE }), "Loan not found"));
  }

  /** Staff list (their branches). `overdue=true` lists active loans past due. */
  async list({ page, limit, sort, status, member, book, branch, overdue, from, to }, actor) {
    const filter = { ...actor.branchFilter("branch") };
    if (status) filter.status = status;
    if (member) filter.member = member;
    if (book) filter.book = book;
    if (branch) filter.branch = branch;
    if (overdue) Object.assign(filter, { status: LOAN_STATUSES.active, dueAt: { $lt: new Date() } });
    if (from || to) filter.checkedOutAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const result = await this.#loans.paginate(filter, { page, limit, sort: toSort(sort), populate: LOAN_POPULATE });
    return pageOf({ ...result, items: LoanResponseDto.fromList(result.items) }, { page, limit });
  }

  /** The signed-in member's loans: current ones plus history. */
  async listOwn(userId, { page, limit, status }) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    const settings = await this.#settings.get();
    const filter = { member: member._id, ...(status && { status }) };
    const result = await this.#loans.paginate(filter, { page, limit, sort: { checkedOutAt: -1, _id: -1 }, populate: LOAN_POPULATE });
    const now = new Date();
    const items = result.items.map((loan) => ({
      ...loan,
      // What an overdue loan would cost if returned now (an estimate, not a charge).
      accruedFine: loan.status === LOAN_STATUSES.active ? overdueFine({ dueAt: loan.dueAt, returnedAt: now }, settings.fines) : 0,
      renewalsLeft: Math.max(0, member.membershipType.maxRenewals - loan.renewals),
    }));
    return pageOf({ ...result, items: LoanResponseDto.fromList(items) }, { page, limit });
  }

  /** Reasons the member may not borrow another item right now (empty: none). */
  async #limitBlocks(member) {
    const settings = await this.#settings.get();
    const blocks = [];
    const active = await this.#loans.countActive(member._id);
    if (active >= member.membershipType.loanLimit) blocks.push(`Loan limit reached (${member.membershipType.loanLimit})`);
    const limit = settings.circulation.blockBorrowingAboveBalance;
    if (limit != null) {
      const balance = await this.#fines.outstandingBalance(member._id);
      if (balance > limit) blocks.push("Outstanding fines exceed the borrowing limit");
    }
    return blocks;
  }

  /**
   * Moves the copy to on_loan. A held copy can only go to the member it is held
   * for. Resolves the reservation this loan fulfils, if any.
   */
  async #claimCopy(copy, member) {
    if (copy.status === S.onHold) {
      const reservation = await this.#reservations.findById(copy.reservation);
      if (!reservation || String(reservation.member) !== String(member._id)) {
        throw new ConflictError("This copy is on hold for another member");
      }
      if (!(await this.#copies.transition(copy._id, S.onHold, S.onLoan, { reservation: null }))) {
        throw new ConflictError("This copy was just lent or moved. Please rescan.");
      }
      return reservation;
    }
    if (!(await this.#copies.transition(copy._id, S.available, S.onLoan))) {
      throw new ConflictError(`This copy is not available (${copy.status.replace("_", " ")})`);
    }
    // Borrowing a copy directly also satisfies the member's place in the queue.
    const waiting = await this.#reservations.findOpen(copy.book._id, member._id);
    return waiting?.status === R.waiting ? waiting : null;
  }

  async #findMember(memberRef) {
    const member = /^[a-f0-9]{24}$/i.test(memberRef)
      ? await this.#members.findWithType(memberRef)
      : await this.#members.findByNumber(memberRef);
    return ensureFound(member, "Member not found");
  }
}
