import { paymentModel } from "../models/payment.model.js";
import { BaseRepository } from "../../../core/base-repository.js";

export class PaymentRepository extends BaseRepository {
  constructor(model = paymentModel) {
    super(model);
  }

  findByIdempotencyKey(key) {
    return this.findOne({ idempotencyKey: key });
  }

  /** Guarded status change: resolves null if the payment is no longer in `from`. */
  transition(paymentId, from, to, fields = {}) {
    return this.updateWhere({ _id: paymentId, status: { $in: [].concat(from) } }, { $set: { status: to, ...fields } });
  }
}
