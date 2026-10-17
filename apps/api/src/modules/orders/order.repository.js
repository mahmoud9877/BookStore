import { BaseRepository } from "../../core/base-repository.js";
import orderModel, { ORDER_STATUSES } from "./order.model.js";

export class OrderRepository extends BaseRepository {
  constructor(model = orderModel) {
    super(model);
  }

  findByIdForUser(id, userId) {
    return this.findOne({ _id: id, userId });
  }

  /** Sets the status (plus any extra fields) and resolves the updated order. */
  updateStatus(id, status, fields = {}) {
    return this.model.findByIdAndUpdate(id, { status, ...fields }, { new: true });
  }

  /**
   * Moves an unpaid order to "rejected" and resolves it, or null if it was not
   * awaiting payment — so callers act on each rejection exactly once.
   */
  rejectIfAwaitingPayment(id) {
    return this.model.findOneAndUpdate(
      { _id: id, status: ORDER_STATUSES.waitPayment },
      { status: ORDER_STATUSES.rejected }
    );
  }
}
