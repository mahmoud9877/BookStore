import mongoose, { Schema, Types, model } from "mongoose";
import { FINE_STATUSES, FINE_TYPES } from "./finance-statuses.js";

/** A charge on a member's account. Amounts are integers in the currency's minor unit. */
const fineSchema = new Schema(
  {
    member: { type: Types.ObjectId, ref: "Member", required: true },
    loan: { type: Types.ObjectId, ref: "Loan", default: null },
    copy: { type: Types.ObjectId, ref: "Copy", default: null },
    branch: { type: Types.ObjectId, ref: "Branch", default: null },
    type: { type: String, enum: Object.values(FINE_TYPES), required: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    paid: { type: Number, default: 0, min: 0 },
    waived: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(FINE_STATUSES), default: FINE_STATUSES.outstanding },
    reason: String,
    createdBy: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// A loan is charged at most once per kind (no duplicate overdue/lost/damaged fines).
fineSchema.index(
  { loan: 1, type: 1 },
  { unique: true, partialFilterExpression: { loan: { $type: "objectId" }, type: { $in: ["overdue", "lost", "damaged"] } } }
);
fineSchema.index({ member: 1, status: 1, createdAt: 1 });
fineSchema.index({ status: 1, createdAt: -1 });

export const fineModel = mongoose.models.Fine || model("Fine", fineSchema);
