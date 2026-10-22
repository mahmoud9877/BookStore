import mongoose, { Schema, Types, model } from "mongoose";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "./finance-statuses.js";

const allocationSchema = new Schema({ fine: { type: Types.ObjectId, ref: "Fine", required: true }, amount: { type: Number, required: true, min: 1 } }, { _id: false });

const refundSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    by: { type: Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
    providerRef: String,
  },
  { _id: false }
);

/**
 * Money received from a member, applied to fines (`allocations`). Card details
 * never reach the API: card payments go through the provider's hosted checkout.
 */
const paymentSchema = new Schema(
  {
    member: { type: Types.ObjectId, ref: "Member", required: true },
    branch: { type: Types.ObjectId, ref: "Branch", default: null },
    method: { type: String, enum: Object.values(PAYMENT_METHODS), required: true },
    status: { type: String, enum: Object.values(PAYMENT_STATUSES), required: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    allocations: [allocationSchema],
    refunds: [refundSchema],
    refundedAmount: { type: Number, default: 0 },
    receiptNumber: { type: String, unique: true, sparse: true },
    // Provider references (card): the checkout session and the captured payment.
    provider: String,
    providerSessionId: { type: String, unique: true, sparse: true },
    providerPaymentRef: String,
    // Client-supplied key: retrying the same request never records a second payment.
    idempotencyKey: { type: String, unique: true, sparse: true },
    recordedBy: { type: Types.ObjectId, ref: "User", default: null },
    paidAt: Date,
    failureReason: String,
  },
  { timestamps: true }
);

paymentSchema.index({ member: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const paymentModel = mongoose.models.Payment || model("Payment", paymentSchema);
