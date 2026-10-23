import { FINE_POPULATE } from "../repositories/fine.repository.js";
import { FineResponseDto } from "../dtos/finance.dto.js";
import { FINE_STATUSES } from "../constants/finance-statuses.js";
import { formatAmount } from "../policies/fine-policy.js";
import { pageOf, toSort } from "../../../core/pagination.js";
import { NOTIFICATION_TYPES } from "../../settings/constants/library-settings.js";
import { BadRequestError, ConflictError, NotFoundError, ensureFound } from "../../../core/http-errors.js";

/** Charges on members' accounts: automatic (overdue/lost/damaged) and manual, and waivers. */
export class FineService {
  #fines;
  #members;
  #settings;
  #notifications;
  #transactions;
  #audit;

  constructor({ fineRepository, memberRepository, settingsService, notificationService, transactionRunner, auditService }) {
    this.#fines = fineRepository;
    this.#members = memberRepository;
    this.#settings = settingsService;
    this.#notifications = notificationService;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  /**
   * Charges a loan-related fine at most once per loan and type (an upsert, so a
   * repeated request never duplicates it). Runs inside the caller's transaction.
   * Resolves the fine, or null when the amount is 0.
   */
  async chargeForLoan({ member, loan, copy, branch, type, amount, reason }, actor) {
    if (!amount) return null;
    const { currency } = await this.#settings.get();
    const fine = await this.#fines.updateWhere(
      { loan: loan._id, type },
      {
        $setOnInsert: {
          member: member._id, loan: loan._id, copy: copy._id, branch, type, currency, amount,
          paid: 0, waived: 0, status: FINE_STATUSES.outstanding, reason, createdBy: actor?.userId ?? null,
        },
      },
      { upsert: true }
    );
    await this.#notifications.notifyMember(
      member,
      NOTIFICATION_TYPES.fineIssued,
      { fineType: type, amount: formatAmount(amount, currency), reason },
      String(fine._id)
    );
    return fine;
  }

  outstandingBalance(memberId) {
    return this.#fines.outstandingBalance(memberId);
  }

  async list({ page, limit, sort, member, status, type, from, to }, actor) {
    const filter = { ...actor.branchFilter("branch") };
    if (member) filter.member = member;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const result = await this.#fines.paginate(filter, { page, limit, sort: toSort(sort), populate: FINE_POPULATE });
    return pageOf({ ...result, items: FineResponseDto.fromList(result.items) }, { page, limit });
  }

  /** The signed-in member's fines and balance. */
  async listOwn(userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    const [fines, balance] = await Promise.all([
      this.#fines.findMany({ member: member._id }, { sort: { createdAt: -1 }, limit: 200, populate: FINE_POPULATE }),
      this.#fines.outstandingBalance(member._id),
    ]);
    const { currency } = await this.#settings.get();
    return { fines: FineResponseDto.fromList(fines), balance, currency };
  }

  /** @param {import("../dtos/finance.dto.js").CreateFineDto} dto */
  async addManual({ member: memberId, amount, reason }, actor) {
    const member = ensureFound(await this.#members.findById(memberId), "Member not found");
    actor.assertBranch(member.homeBranch);
    const { currency } = await this.#settings.get();
    return this.#transactions.run(async () => {
      const fine = await this.#fines.create({
        member: member._id, branch: member.homeBranch, type: "manual", currency, amount, reason, createdBy: actor.userId,
      });
      await this.#audit.record(actor, { action: "fine.create", entity: "Fine", entityId: fine._id, branch: member.homeBranch, after: fine, reason });
      await this.#notifications.notifyMember(member, NOTIFICATION_TYPES.fineIssued, { fineType: "manual", amount: formatAmount(amount, currency), reason }, String(fine._id));
      return FineResponseDto.from(fine);
    });
  }

  /** Waives all or part of a fine's remaining balance, with a reason (audited). */
  async waive({ id, amount, reason }, actor) {
    const fine = ensureFound(await this.#fines.findById(id), "Fine not found");
    if (fine.branch) actor.assertBranch(fine.branch);
    const balance = fine.amount - fine.paid - fine.waived;
    if (fine.status !== FINE_STATUSES.outstanding || balance <= 0) throw new BadRequestError("Nothing is left to waive on this fine");
    const waived = amount ?? balance;
    if (waived > balance) throw new BadRequestError(`At most ${balance} can be waived`);
    return this.#transactions.run(async () => {
      const updated = await this.#fines.settle(id, waived, "waived");
      if (!updated) throw new ConflictError("The fine changed meanwhile. Reload and try again.");
      await this.#audit.record(actor, {
        action: "fine.waive", entity: "Fine", entityId: id, branch: fine.branch,
        before: { waived: fine.waived, status: fine.status }, after: { waived: updated.waived, status: updated.status }, reason,
      });
      return FineResponseDto.from(updated);
    });
  }
}
