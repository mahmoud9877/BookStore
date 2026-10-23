import { reservationModel } from "../models/reservation.model.js";
import { OPEN_RESERVATION_STATUSES, RESERVATION_STATUSES } from "../constants/circulation-statuses.js";
import { BaseRepository } from "../../../core/base-repository.js";

export const RESERVATION_POPULATE = [
  { path: "book", select: "bookTitle author isbn image" },
  { path: "member", select: "memberNumber name email" },
  { path: "pickupBranch", select: "code name" },
  { path: "copy", select: "barcode branch" },
];

export class ReservationRepository extends BaseRepository {
  constructor(model = reservationModel) {
    super(model);
  }

  findOpen(bookId, memberId) {
    return this.findOne({ book: bookId, member: memberId, status: { $in: OPEN_RESERVATION_STATUSES } });
  }

  countOpen(memberId) {
    return this.countWhere({ member: memberId, status: { $in: OPEN_RESERVATION_STATUSES } });
  }

  countWaiting(bookId) {
    return this.countWhere({ book: bookId, status: RESERVATION_STATUSES.waiting });
  }

  /**
   * The next waiting reservation for a copy that is at `branchId`: the oldest one
   * collecting there, else (when cross-branch pickup is allowed) the oldest one anywhere.
   */
  async nextWaiting(bookId, branchId, allowCrossBranch) {
    const waiting = { book: bookId, status: RESERVATION_STATUSES.waiting };
    const local = await this.findOne({ ...waiting, pickupBranch: branchId }, { sort: { createdAt: 1, _id: 1 } });
    if (local || !allowCrossBranch) return local;
    return this.findOne(waiting, { sort: { createdAt: 1, _id: 1 } });
  }

  /** Atomic status change guarded by the expected current status(es). */
  transition(reservationId, fromStatuses, to, fields = {}) {
    return this.updateWhere(
      { _id: reservationId, status: { $in: [].concat(fromStatuses) } },
      { $set: { status: to, ...fields } }
    );
  }

  /** 1-based position of a waiting reservation in its title's queue. */
  async queuePosition(reservation) {
    if (reservation.status !== RESERVATION_STATUSES.waiting) return null;
    const ahead = await this.countWhere({
      book: reservation.book?._id ?? reservation.book,
      status: RESERVATION_STATUSES.waiting,
      $or: [
        { createdAt: { $lt: reservation.createdAt } },
        { createdAt: reservation.createdAt, _id: { $lt: reservation._id } },
      ],
    });
    return ahead + 1;
  }
}
