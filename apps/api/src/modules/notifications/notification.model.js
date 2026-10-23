import mongoose, { Schema, Types, model } from "mongoose";

export const NOTIFICATION_CHANNELS = Object.freeze({ inApp: "in_app", email: "email" });

// Values are persisted; do not rename them.
export const DELIVERY_STATUSES = Object.freeze({
  pending: "pending", // email waiting for the worker
  sending: "sending", // claimed by a worker (lease until lockedUntil)
  sent: "sent", // email delivered to the provider, or in-app message available
  failed: "failed", // gave up after the maximum attempts
  skipped: "skipped", // e.g. no email address, or email disabled
});

/**
 * One message to one member on one channel. Written in the same transaction as
 * the event that caused it (outbox), then delivered by the worker.
 */
const notificationSchema = new Schema(
  {
    member: { type: Types.ObjectId, ref: "Member", default: null },
    user: { type: Types.ObjectId, ref: "User", default: null }, // for the in-app inbox
    type: { type: String, required: true },
    channel: { type: String, enum: Object.values(NOTIFICATION_CHANNELS), required: true },
    to: String, // email address (email channel)
    subject: { type: String, required: true },
    body: { type: String, required: true },
    // Values a client needs to show the message in its own language (template values for library notices).
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    status: { type: String, enum: Object.values(DELIVERY_STATUSES), required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: Date,
    lastError: String,
    sentAt: Date,
    readAt: Date,
    // The same event never notifies twice (e.g. "loan.due_soon:<loan>:<due date>:email").
    dedupeKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

notificationSchema.index({ channel: 1, status: 1, nextAttemptAt: 1 });
notificationSchema.index({ user: 1, channel: 1, createdAt: -1 });

export const notificationModel = mongoose.models.Notification || model("Notification", notificationSchema);
