import mongoose, { Schema, model } from "mongoose";

export const COUPON_TYPES = Object.freeze({ percent: "percent", fixed: "fixed" });

/** A shop discount code. `usedCount` is managed by the server (claimed when an order is placed). */
const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    type: { type: String, required: true, enum: Object.values(COUPON_TYPES) },
    // percent: 1–100; fixed: an amount off the order, in major units.
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    maxUses: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const couponModel = mongoose.models.Coupon || model("Coupon", couponSchema);
