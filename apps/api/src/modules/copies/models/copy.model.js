import mongoose, { Schema, Types, model } from "mongoose";
import { COPY_CONDITIONS, COPY_STATUSES } from "../constants/copy-statuses.js";

/** One physical item that can be lent. */
const copySchema = new Schema(
  {
    book: { type: Types.ObjectId, ref: "Book", required: true },
    barcode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    branch: { type: Types.ObjectId, ref: "Branch", required: true }, // the branch that owns/shelves it
    location: { type: Types.ObjectId, ref: "Location", default: null }, // shelf
    status: { type: String, enum: Object.values(COPY_STATUSES), default: COPY_STATUSES.available },
    condition: { type: String, enum: COPY_CONDITIONS, default: "good" },
    // Acquisition details (cost in minor units of the library currency).
    cost: { type: Number, min: 0, default: null },
    acquiredAt: Date,
    supplier: { type: Types.ObjectId, ref: "Supplier", default: null },
    purchaseOrder: { type: Types.ObjectId, ref: "PurchaseOrder", default: null },
    notes: String,
    // Set while the copy is held for a reservation or moving between branches.
    reservation: { type: Types.ObjectId, ref: "Reservation", default: null },
    transfer: { type: Types.ObjectId, ref: "Transfer", default: null },
  },
  { timestamps: true }
);

// Availability by title/branch/status is the hottest query (catalogue, circulation, reports).
copySchema.index({ book: 1, status: 1, branch: 1 });
copySchema.index({ branch: 1, status: 1 });
copySchema.index({ location: 1 });

export const copyModel = mongoose.models.Copy || model("Copy", copySchema);
