import mongoose, { Schema, Types, model } from "mongoose";
import { LOAN_STATUSES } from "./circulation-statuses.js";

const loanSchema = new Schema(
  {
    copy: { type: Types.ObjectId, ref: "Copy", required: true },
    book: { type: Types.ObjectId, ref: "Book", required: true },
    member: { type: Types.ObjectId, ref: "Member", required: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true }, // where it was checked out
    status: { type: String, enum: Object.values(LOAN_STATUSES), default: LOAN_STATUSES.active },
    checkedOutAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    renewals: { type: Number, default: 0 },
    returnedAt: Date,
    returnBranch: { type: Types.ObjectId, ref: "Branch", default: null },
    checkedOutBy: { type: Types.ObjectId, ref: "User", default: null },
    returnedBy: { type: Types.ObjectId, ref: "User", default: null },
    // Set when staff lent beyond a limit or block; also recorded in the audit log.
    overrideReason: String,
    returnNotes: String,
  },
  { timestamps: true }
);

// The database itself refuses a second active loan of the same copy.
loanSchema.index({ copy: 1 }, { unique: true, partialFilterExpression: { status: LOAN_STATUSES.active } });
loanSchema.index({ member: 1, status: 1, dueAt: 1 });
loanSchema.index({ status: 1, dueAt: 1 });
loanSchema.index({ book: 1, checkedOutAt: -1 });
loanSchema.index({ branch: 1, checkedOutAt: -1 });
loanSchema.index({ checkedOutAt: -1 });

export const loanModel = mongoose.models.Loan || model("Loan", loanSchema);
