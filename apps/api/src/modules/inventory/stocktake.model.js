import mongoose, { Schema, Types, model } from "mongoose";

export const STOCKTAKE_STATUSES = Object.freeze({ open: "open", closed: "closed", cancelled: "cancelled" });

/**
 * A count of what is physically on the shelves of a branch (or one room/shelf),
 * compared with what the records say should be there.
 */
const stocktakeSchema = new Schema(
  {
    branch: { type: Types.ObjectId, ref: "Branch", required: true },
    location: { type: Types.ObjectId, ref: "Location", default: null }, // limit to one room/shelf
    status: { type: String, enum: Object.values(STOCKTAKE_STATUSES), default: STOCKTAKE_STATUSES.open },
    startedBy: { type: Types.ObjectId, ref: "User" },
    closedBy: { type: Types.ObjectId, ref: "User" },
    closedAt: Date,
    notes: String,
    // Filled when closed.
    result: {
      expected: Number,
      found: Number,
      missing: Number,
      foundAgain: Number, // previously missing/lost copies that turned up
      unexpected: Number, // scanned copies registered elsewhere
      applied: Boolean,
    },
  },
  { timestamps: true }
);

// One open stocktake per branch at a time.
stocktakeSchema.index({ branch: 1 }, { unique: true, partialFilterExpression: { status: "open" } });

export const stocktakeModel = mongoose.models.Stocktake || model("Stocktake", stocktakeSchema);

/** Each scanned barcode (one row per copy, so scans can be repeated safely). */
const stocktakeScanSchema = new Schema(
  {
    stocktake: { type: Types.ObjectId, ref: "Stocktake", required: true },
    barcode: { type: String, required: true },
    copy: { type: Types.ObjectId, ref: "Copy", default: null }, // null: unknown barcode
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stocktakeScanSchema.index({ stocktake: 1, barcode: 1 }, { unique: true });

export const stocktakeScanModel = mongoose.models.StocktakeScan || model("StocktakeScan", stocktakeScanSchema);
