import mongoose, { Schema, Types, model } from "mongoose";

/** A room members can book (study room, reading room, meeting room). */
const roomSchema = new Schema(
  {
    branch: { type: Types.ObjectId, ref: "Branch", required: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["study", "reading", "meeting", "event"], default: "study" },
    capacity: { type: Number, required: true, min: 1 },
    features: [String],
    isActive: { type: Boolean, default: true },
    // Incremented by every booking transaction for this room, so two bookings of
    // the same room can never commit concurrently (the loser retries and sees the conflict).
    bookingVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);
roomSchema.index({ branch: 1, name: 1 }, { unique: true });

export const roomModel = mongoose.models.Room || model("Room", roomSchema);

export const BOOKING_STATUSES = Object.freeze({ confirmed: "confirmed", cancelled: "cancelled" });

const roomBookingSchema = new Schema(
  {
    room: { type: Types.ObjectId, ref: "Room", required: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true },
    member: { type: Types.ObjectId, ref: "Member", default: null }, // null: booked by staff (e.g. for an event)
    event: { type: Types.ObjectId, ref: "Event", default: null },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    purpose: String,
    status: { type: String, enum: Object.values(BOOKING_STATUSES), default: BOOKING_STATUSES.confirmed },
    bookedBy: { type: Types.ObjectId, ref: "User" },
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);
roomBookingSchema.index({ room: 1, status: 1, startAt: 1, endAt: 1 });
roomBookingSchema.index({ member: 1, startAt: -1 });

export const roomBookingModel = mongoose.models.RoomBooking || model("RoomBooking", roomBookingSchema);

export const EVENT_STATUSES = Object.freeze({ scheduled: "scheduled", cancelled: "cancelled" });

const eventSchema = new Schema(
  {
    branch: { type: Types.ObjectId, ref: "Branch", required: true },
    room: { type: Types.ObjectId, ref: "Room", default: null },
    title: { type: String, required: true, trim: true },
    description: String,
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1 },
    registered: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(EVENT_STATUSES), default: EVENT_STATUSES.scheduled },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);
eventSchema.index({ status: 1, startAt: 1 });
eventSchema.index({ branch: 1, startAt: 1 });

export const eventModel = mongoose.models.Event || model("Event", eventSchema);

const eventRegistrationSchema = new Schema(
  {
    event: { type: Types.ObjectId, ref: "Event", required: true },
    member: { type: Types.ObjectId, ref: "Member", required: true },
    status: { type: String, enum: ["registered", "cancelled"], default: "registered" },
  },
  { timestamps: true }
);
eventRegistrationSchema.index({ event: 1, member: 1 }, { unique: true, partialFilterExpression: { status: "registered" } });
eventRegistrationSchema.index({ member: 1, createdAt: -1 });

export const eventRegistrationModel = mongoose.models.EventRegistration || model("EventRegistration", eventRegistrationSchema);
