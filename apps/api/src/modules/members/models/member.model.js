import mongoose, { Schema, Types, model } from "mongoose";

export const MEMBER_KINDS = Object.freeze(["individual", "student", "researcher", "institution"]);

/**
 * Borrowing rules per kind of membership. Limits are per member; durations in days.
 * A member's type decides how many items they may borrow, for how long, and how
 * often they may renew.
 */
const membershipTypeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "STUDENT"
    name: { type: String, required: true, trim: true },
    description: String,
    loanLimit: { type: Number, required: true, min: 0 }, // concurrent loans
    loanPeriodDays: { type: Number, required: true, min: 1 },
    maxRenewals: { type: Number, required: true, min: 0 },
    reservationLimit: { type: Number, required: true, min: 0 }, // concurrent active reservations
    membershipMonths: { type: Number, required: true, min: 1 }, // validity of a new or renewed membership
    canAccessDigital: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const membershipTypeModel = mongoose.models.MembershipType || model("MembershipType", membershipTypeSchema);

// Values are persisted in members.status; do not rename them.
export const MEMBER_STATUSES = Object.freeze({
  active: "active",
  suspended: "suspended", // blocked by staff (e.g. unpaid fines); reversible
  cancelled: "cancelled", // closed for good
});

/** A library patron. `user` links the member to a sign-in account for self-service. */
const memberSchema = new Schema(
  {
    memberNumber: { type: String, required: true, unique: true },
    user: { type: Types.ObjectId, ref: "User", default: null },
    kind: { type: String, enum: MEMBER_KINDS, default: "individual" },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    address: String,
    institution: String, // school, university or organisation
    membershipType: { type: Types.ObjectId, ref: "MembershipType", required: true },
    homeBranch: { type: Types.ObjectId, ref: "Branch", required: true },
    status: { type: String, enum: Object.values(MEMBER_STATUSES), default: MEMBER_STATUSES.active },
    statusReason: String,
    joinedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    notes: String,
    // Incremented at the start of each checkout transaction: concurrent checkouts
    // for one member then conflict, and the loser retries with fresh counts.
    circulationVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

memberSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } });
memberSchema.index({ email: 1 });
memberSchema.index({ homeBranch: 1, status: 1 });
memberSchema.index({ expiresAt: 1, status: 1 });

export const memberModel = mongoose.models.Member || model("Member", memberSchema);

/** Membership history: joins, renewals, suspensions, type changes. */
const membershipEventSchema = new Schema(
  {
    member: { type: Types.ObjectId, ref: "Member", required: true, index: true },
    type: { type: String, required: true }, // joined | renewed | suspended | reactivated | cancelled | type_changed
    actor: { type: Types.ObjectId, ref: "User", default: null },
    details: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const membershipEventModel = mongoose.models.MembershipEvent || model("MembershipEvent", membershipEventSchema);
