import mongoose, { Schema, Types, model } from "mongoose";
import { OPEN_RESERVATION_STATUSES, RESERVATION_STATUSES } from "./circulation-statuses.js";

/** A member's place in the queue for a title, to collect at a pickup branch. */
const reservationSchema = new Schema(
  {
    book: { type: Types.ObjectId, ref: "Book", required: true },
    member: { type: Types.ObjectId, ref: "Member", required: true },
    pickupBranch: { type: Types.ObjectId, ref: "Branch", required: true },
    status: { type: String, enum: Object.values(RESERVATION_STATUSES), default: RESERVATION_STATUSES.waiting },
    copy: { type: Types.ObjectId, ref: "Copy", default: null }, // allocated copy (in transit or held)
    readyAt: Date,
    expiresAt: Date, // pickup deadline once ready
    closedAt: Date, // fulfilled, cancelled or expired
    cancelReason: String,
    placedBy: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// One open reservation per member and title.
reservationSchema.index(
  { book: 1, member: 1 },
  { unique: true, partialFilterExpression: { status: { $in: OPEN_RESERVATION_STATUSES } } }
);
// The queue: oldest waiting first.
reservationSchema.index({ book: 1, status: 1, createdAt: 1 });
reservationSchema.index({ member: 1, status: 1 });
reservationSchema.index({ status: 1, expiresAt: 1 });
reservationSchema.index({ pickupBranch: 1, status: 1 });

export const reservationModel = mongoose.models.Reservation || model("Reservation", reservationSchema);
