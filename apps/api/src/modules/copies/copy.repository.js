import { Types } from "mongoose";
import { copyModel } from "./copy.model.js";
import { COPY_STATUSES } from "./copy-statuses.js";
import { BaseRepository } from "../../core/base-repository.js";

const toObjectIds = (ids) => ids.map((id) => new Types.ObjectId(String(id)));

export const COPY_POPULATE = [
  { path: "book", select: "bookTitle author isbn edition image" },
  { path: "branch", select: "code name" },
  { path: "location", select: "code name type" },
];

export class CopyRepository extends BaseRepository {
  constructor(model = copyModel) {
    super(model);
  }

  findByBarcode(barcode) {
    return this.findOne({ barcode: barcode.trim().toUpperCase() }, { populate: COPY_POPULATE });
  }

  /**
   * Atomically moves a copy from one of `fromStatuses` to `to` (plus `extra`
   * fields). Resolves null when the copy is no longer in an expected status —
   * the guard against two desks lending the same copy at once.
   */
  transition(copyId, fromStatuses, to, extra = {}) {
    return this.updateWhere(
      { _id: copyId, status: { $in: [].concat(fromStatuses) } },
      { $set: { status: to, ...extra } }
    );
  }

  /** First available copy of `bookId`, preferring `branchId`. */
  findAvailable(bookId, branchId) {
    const filter = { book: bookId, status: COPY_STATUSES.available };
    return branchId ? this.findOne({ ...filter, branch: branchId }) : this.findOne(filter);
  }

  /**
   * Copy counts per book and status, optionally per branch:
   * `{ [bookId]: { total, available, byStatus: {...}, byBranch: { [branchId]: {...} } } }`.
   */
  async availabilityFor(bookIds) {
    if (!bookIds.length) return {};
    const rows = await this.aggregate([
      { $match: { book: { $in: toObjectIds(bookIds) }, status: { $ne: COPY_STATUSES.withdrawn } } },
      { $group: { _id: { book: "$book", branch: "$branch", status: "$status" }, count: { $sum: 1 } } },
    ]);
    const result = {};
    for (const { _id, count } of rows) {
      const book = (result[_id.book] ??= { total: 0, available: 0, byStatus: {}, byBranch: {} });
      const branch = (book.byBranch[_id.branch] ??= { total: 0, available: 0 });
      book.total += count;
      branch.total += count;
      book.byStatus[_id.status] = (book.byStatus[_id.status] ?? 0) + count;
      if (_id.status === COPY_STATUSES.available) {
        book.available += count;
        branch.available += count;
      }
    }
    return result;
  }

  /** Inventory counts per branch and status: `[{ branch, status, count }]`. */
  countsByBranchAndStatus(filter = {}) {
    return this.aggregate([
      { $match: filter },
      { $group: { _id: { branch: "$branch", status: "$status" }, count: { $sum: 1 } } },
      { $project: { _id: 0, branch: "$_id.branch", status: "$_id.status", count: 1 } },
    ]);
  }
}
