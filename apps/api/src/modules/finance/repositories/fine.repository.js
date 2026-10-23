import { Types } from "mongoose";
import { fineModel } from "../models/fine.model.js";
import { FINE_STATUSES } from "../constants/finance-statuses.js";
import { BaseRepository } from "../../../core/base-repository.js";

export const FINE_POPULATE = [
  { path: "member", select: "memberNumber name" },
  { path: "copy", select: "barcode" },
  { path: "branch", select: "code name" },
];

/** `amount - paid - waived`, as a MongoDB expression. */
const BALANCE = { $subtract: ["$amount", { $add: ["$paid", "$waived"] }] };

export class FineRepository extends BaseRepository {
  constructor(model = fineModel) {
    super(model);
  }

  /** Sum still owed by a member (0 when nothing is outstanding). */
  async outstandingBalance(memberId) {
    const [row] = await this.aggregate([
      { $match: { member: new Types.ObjectId(String(memberId)), status: FINE_STATUSES.outstanding } },
      { $group: { _id: null, balance: { $sum: BALANCE } } },
    ]);
    return row?.balance ?? 0;
  }

  /** Outstanding fines, oldest first (payments settle the oldest charges first). */
  listOutstanding(memberId, fineIds) {
    const filter = { member: memberId, status: FINE_STATUSES.outstanding };
    if (fineIds?.length) filter._id = { $in: fineIds };
    return this.findMany(filter, { sort: { createdAt: 1, _id: 1 } });
  }

  /**
   * Adds to `paid` (or `waived`) only if the fine still has at least `amount`
   * left, and closes it when nothing remains. Resolves null otherwise.
   */
  async settle(fineId, amount, field = "paid") {
    const fine = await this.updateWhere(
      { _id: fineId, status: FINE_STATUSES.outstanding, $expr: { $gte: [BALANCE, amount] } },
      { $inc: { [field]: amount } }
    );
    if (!fine) return null;
    if (fine.amount - fine.paid - fine.waived === 0) {
      const closed = fine.waived > 0 ? FINE_STATUSES.waived : FINE_STATUSES.paid;
      return this.updateWhere({ _id: fineId }, { $set: { status: closed } });
    }
    return fine;
  }

  /** Reverses part of a payment (refund): reopens the fine. */
  unsettle(fineId, amount) {
    return this.updateWhere(
      { _id: fineId, paid: { $gte: amount } },
      { $inc: { paid: -amount }, $set: { status: FINE_STATUSES.outstanding } }
    );
  }
}
