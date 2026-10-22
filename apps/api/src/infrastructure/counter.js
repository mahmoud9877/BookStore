import mongoose, { Schema, model } from "mongoose";
import { currentSession } from "../core/transaction-context.js";

const counterSchema = new Schema({ key: { type: String, required: true, unique: true }, seq: { type: Number, default: 0 } });
const counterModel = mongoose.models.Counter || model("Counter", counterSchema);

/**
 * Gap-tolerant sequential numbers (barcodes, member numbers, receipts, purchase
 * orders). Each `next()` is one atomic `$inc`, so concurrent callers never get
 * the same number.
 */
export class SequenceGenerator {
  constructor(model = counterModel) {
    this.model = model;
  }

  async next(key) {
    const session = currentSession();
    const counter = await this.model
      .findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true, ...(session && { session }) })
      .lean();
    return counter.seq;
  }

  /** "PREFIX-000042" style identifiers. */
  async nextCode(key, prefix, width = 6) {
    return `${prefix}-${String(await this.next(key)).padStart(width, "0")}`;
  }
}
