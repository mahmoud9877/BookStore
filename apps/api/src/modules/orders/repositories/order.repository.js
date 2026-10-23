import orderModel from "../models/order.model.js";
import { ORDER_STATUSES } from "../constants/order-statuses.js";
import { BaseRepository } from "../../../core/base-repository.js";

export class OrderRepository extends BaseRepository {
  constructor(model = orderModel) {
    super(model);
  }

  findByIdForUser(id, userId) {
    return this.findOne({ _id: id, userId });
  }

  /** Sets the status (plus any extra fields) and resolves the updated order. */
  updateStatus(id, status, fields = {}) {
    return this.updateWhere({ _id: id }, { status, ...fields });
  }

  /**
   * Moves an unpaid order to "rejected" and resolves it, or null if it was not
   * awaiting payment — so callers act on each rejection exactly once.
   */
  rejectIfAwaitingPayment(id) {
    return this.updateWhere(
      { _id: id, status: ORDER_STATUSES.waitPayment },
      { status: ORDER_STATUSES.rejected },
      { returnOriginal: true }
    );
  }
}
