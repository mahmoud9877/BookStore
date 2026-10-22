import { RESERVATION_POPULATE } from "./reservation.repository.js";
import { ReservationResponseDto } from "./circulation.dto.js";
import { OPEN_RESERVATION_STATUSES, RESERVATION_STATUSES } from "./circulation-statuses.js";
import { COPY_STATUSES } from "../copies/copy-statuses.js";
import { TRANSFER_STATUSES } from "../transfers/transfer.model.js";
import { MemberPolicy } from "../members/member-policy.js";
import { NOTIFICATION_TYPES } from "../settings/library-settings.js";
import { pageOf, toSort } from "../../core/pagination.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ensureFound } from "../../core/http-errors.js";

const R = RESERVATION_STATUSES;
const S = COPY_STATUSES;

/**
 * Reservations (holds): a queue per title. Placing one allocates a copy at once
 * when one is on a shelf (held at, or sent to, the pickup branch); otherwise the
 * member waits for the next returned copy.
 */
export class ReservationService {
  #reservations;
  #members;
  #books;
  #branches;
  #copies;
  #loans;
  #transfers;
  #allocator;
  #settings;
  #notifications;
  #transactions;
  #audit;

  constructor({
    reservationRepository, memberRepository, bookRepository, branchRepository, copyRepository, loanRepository,
    transferRepository, copyAllocator, settingsService, notificationService, transactionRunner, auditService,
  }) {
    this.#reservations = reservationRepository;
    this.#members = memberRepository;
    this.#books = bookRepository;
    this.#branches = branchRepository;
    this.#copies = copyRepository;
    this.#loans = loanRepository;
    this.#transfers = transferRepository;
    this.#allocator = copyAllocator;
    this.#settings = settingsService;
    this.#notifications = notificationService;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  /** A member reserves for themselves. */
  async placeOwn(userId, { book, pickupBranch }) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    return this.#place(member, { book, pickupBranch }, { userId, userName: member.name });
  }

  /** Staff reserve on a member's behalf (at a pickup branch they serve). */
  async placeForMember({ member: memberId, book, pickupBranch }, actor) {
    actor.assertBranch(pickupBranch);
    const member = ensureFound(await this.#members.findWithType(memberId), "Member not found");
    return this.#place(member, { book, pickupBranch }, actor);
  }

  async #place(member, { book: bookId, pickupBranch }, actor) {
    MemberPolicy.assertInGoodStanding(member);
    const book = ensureFound(await this.#books.findById(bookId), "Book not found");
    const branch = ensureFound(await this.#branches.findById(pickupBranch), "Branch not found");
    if (!branch.isActive) throw new BadRequestError("This branch does not accept pickups");
    const settings = await this.#settings.get();

    const reservation = await this.#transactions.run(async () => {
      await this.#members.updateWhere({ _id: member._id }, { $inc: { circulationVersion: 1 } });
      if (await this.#reservations.findOpen(book._id, member._id)) throw new ConflictError("You already have a reservation for this title");
      if (await this.#loans.findOne({ member: member._id, book: book._id, status: "active" })) {
        throw new ConflictError("This title is already on loan to the member");
      }
      const open = await this.#reservations.countOpen(member._id);
      if (open >= member.membershipType.reservationLimit) {
        throw new ForbiddenError(`Reservation limit reached (${member.membershipType.reservationLimit})`);
      }
      const lendable = await this.#copies.countWhere({ book: book._id, status: { $nin: [S.withdrawn, S.lost] } });
      if (!lendable) throw new BadRequestError("The library has no copies of this title to lend");

      const created = await this.#reservations.create({
        book: book._id, member: member._id, pickupBranch: branch._id, placedBy: actor.userId ?? null,
      });
      // A copy on a shelf right now: hold it here, or send one from another branch.
      const local = await this.#copies.findAvailable(book._id, branch._id);
      const anywhere = local ?? (settings.reservations.allowCrossBranchPickup ? await this.#copies.findAvailable(book._id) : null);
      if (anywhere) await this.#allocator.release(anywhere, anywhere.branch, actor);
      await this.#audit.record(actor, { action: "reservation.place", entity: "Reservation", entityId: created._id, branch: branch._id, after: { book: book._id, member: member.memberNumber } });
      return created;
    });
    return this.get(reservation._id);
  }

  /**
   * Cancels an open reservation. A copy already allocated to it is released to
   * the next member in the queue (or back to the shelf).
   */
  async cancel({ id, reason }, actor, { asMemberUserId } = {}) {
    const reservation = ensureFound(await this.#reservations.findById(id), "Reservation not found");
    if (asMemberUserId) {
      const member = await this.#members.findById(reservation.member);
      if (String(member?.user) !== String(asMemberUserId)) throw new NotFoundError("Reservation not found");
    } else {
      actor.assertBranch(reservation.pickupBranch);
    }
    if (!OPEN_RESERVATION_STATUSES.includes(reservation.status)) throw new BadRequestError("This reservation is already closed");
    await this.#close(reservation, R.cancelled, { cancelReason: reason || (asMemberUserId ? "Cancelled by the member" : "Cancelled by staff") }, actor);
    return this.get(id);
  }

  /** Worker job: expires ready reservations past their pickup deadline. Resolves the count. */
  async expireOverdueHolds(actor) {
    const expired = await this.#reservations.findMany({ status: R.ready, expiresAt: { $lt: new Date() } }, { limit: 200 });
    let count = 0;
    for (const reservation of expired) {
      try {
        await this.#close(reservation, R.expired, {}, actor);
        const [member, book] = await Promise.all([this.#members.findById(reservation.member), this.#books.findById(reservation.book)]);
        await this.#notifications.notifyMember(member, NOTIFICATION_TYPES.reservationExpired, { title: book?.bookTitle }, String(reservation._id));
        count += 1;
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error; // collected or cancelled meanwhile
      }
    }
    return count;
  }

  async #close(reservation, status, fields, actor) {
    await this.#transactions.run(async () => {
      const closed = await this.#reservations.transition(reservation._id, reservation.status, status, { ...fields, closedAt: new Date() });
      if (!closed) throw new ConflictError("The reservation changed meanwhile. Reload and try again.");
      if (reservation.status === R.ready && reservation.copy) {
        const copy = await this.#copies.findById(reservation.copy);
        if (copy?.status === S.onHold && String(copy.reservation) === String(reservation._id)) {
          await this.#allocator.release(copy, reservation.pickupBranch, actor);
        }
      }
      if (reservation.status === R.inTransit && reservation.copy) {
        // The copy keeps travelling; on arrival it is allocated afresh. Detach it.
        const transfer = await this.#transfers.findOne({ copy: reservation.copy, status: TRANSFER_STATUSES.inTransit });
        if (transfer) await this.#transfers.updateById(transfer._id, { reservation: null });
        await this.#copies.updateWhere({ _id: reservation.copy, reservation: reservation._id }, { $set: { reservation: null } });
      }
      await this.#audit.record(actor, { action: `reservation.${status}`, entity: "Reservation", entityId: reservation._id, branch: reservation.pickupBranch, before: { status: reservation.status }, after: { status }, reason: fields.cancelReason });
    });
  }

  async get(id) {
    const reservation = ensureFound(await this.#reservations.findById(id, { populate: RESERVATION_POPULATE }), "Reservation not found");
    return ReservationResponseDto.from({ ...reservation, queuePosition: await this.#reservations.queuePosition(reservation) });
  }

  async list({ page, limit, sort, status, book, member, pickupBranch }, actor) {
    const filter = { ...actor.branchFilter("pickupBranch") };
    if (status) filter.status = status;
    if (book) filter.book = book;
    if (member) filter.member = member;
    if (pickupBranch) filter.pickupBranch = pickupBranch;
    const result = await this.#reservations.paginate(filter, { page, limit, sort: toSort(sort), populate: RESERVATION_POPULATE });
    return pageOf({ ...result, items: ReservationResponseDto.fromList(result.items) }, { page, limit });
  }

  async listOwn(userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    const reservations = await this.#reservations.findMany({ member: member._id }, { sort: { createdAt: -1 }, limit: 100, populate: RESERVATION_POPULATE });
    const withPositions = await Promise.all(
      reservations.map(async (reservation) => ({ ...reservation, queuePosition: await this.#reservations.queuePosition(reservation) }))
    );
    return ReservationResponseDto.fromList(withPositions);
  }
}
