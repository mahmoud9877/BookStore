import mongoose, { Schema, Types, model } from "mongoose";

const branchSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "MAIN"
    name: { type: String, required: true, trim: true },
    address: String,
    phone: String,
    email: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const branchModel = mongoose.models.Branch || model("Branch", branchSchema);

// Physical places inside a branch: rooms contain shelves. Copies point at a shelf.
export const LOCATION_TYPES = Object.freeze({ room: "room", shelf: "shelf" });

const locationSchema = new Schema(
  {
    branch: { type: Types.ObjectId, ref: "Branch", required: true },
    type: { type: String, enum: Object.values(LOCATION_TYPES), required: true },
    parent: { type: Types.ObjectId, ref: "Location", default: null }, // a shelf's room
    code: { type: String, required: true, uppercase: true, trim: true }, // e.g. "A-12"
    name: { type: String, trim: true },
  },
  { timestamps: true }
);

locationSchema.index({ branch: 1, code: 1 }, { unique: true });

export const locationModel = mongoose.models.Location || model("Location", locationSchema);
