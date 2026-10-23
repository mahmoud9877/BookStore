import mongoose, { Schema, Types, model } from "mongoose";

// Values are persisted; do not rename them.
export const TRANSFER_STATUSES = Object.freeze({
  requested: "requested", // asked for; the copy is still on the shelf at the source
  inTransit: "in_transit", // shipped; the copy is unavailable until received
  received: "received",
  cancelled: "cancelled",
});

export const TRANSFER_REASONS = Object.freeze({
  rebalancing: "rebalancing", // staff move stock between branches
  reservation: "reservation", // carrying a copy to a member's pickup branch
  returnHome: "return_home", // a copy returned at another branch goes back
});

const T = TRANSFER_STATUSES;
export const TRANSFER_TRANSITIONS = Object.freeze({
  [T.requested]: [T.inTransit, T.cancelled],
  [T.inTransit]: [T.received, T.cancelled],
  [T.received]: [],
  [T.cancelled]: [],
});

const historySchema = new Schema(
  { status: String, at: { type: Date, default: Date.now }, by: { type: Types.ObjectId, ref: "User" }, note: String },
  { _id: false }
);

/** One copy moving from one branch to another, with its full status history. */
const transferSchema = new Schema(
  {
    copy: { type: Types.ObjectId, ref: "Copy", required: true },
    book: { type: Types.ObjectId, ref: "Book", required: true },
    fromBranch: { type: Types.ObjectId, ref: "Branch", required: true },
    toBranch: { type: Types.ObjectId, ref: "Branch", required: true },
    status: { type: String, enum: Object.values(T), required: true },
    reason: { type: String, enum: Object.values(TRANSFER_REASONS), required: true },
    reservation: { type: Types.ObjectId, ref: "Reservation", default: null },
    note: String,
    history: [historySchema],
  },
  { timestamps: true }
);

// A copy can be in at most one open transfer.
transferSchema.index(
  { copy: 1 },
  { unique: true, partialFilterExpression: { status: { $in: [T.requested, T.inTransit] } } }
);
transferSchema.index({ toBranch: 1, status: 1 });
transferSchema.index({ fromBranch: 1, status: 1 });
transferSchema.index({ createdAt: -1 });

export const transferModel = mongoose.models.Transfer || model("Transfer", transferSchema);
