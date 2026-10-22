import mongoose, { Schema, Types, model } from "mongoose";

const supplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    contactName: String,
    email: String,
    phone: String,
    address: String,
    notes: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const supplierModel = mongoose.models.Supplier || model("Supplier", supplierSchema);

// Values are persisted; do not rename them.
export const PURCHASE_STATUSES = Object.freeze({
  requested: "requested", // a purchase request from staff
  approved: "approved",
  ordered: "ordered", // sent to the supplier (a purchase order)
  partiallyReceived: "partially_received",
  received: "received",
  rejected: "rejected",
  cancelled: "cancelled",
});

const P = PURCHASE_STATUSES;
export const PURCHASE_TRANSITIONS = Object.freeze({
  [P.requested]: [P.approved, P.rejected, P.cancelled],
  [P.approved]: [P.ordered, P.cancelled],
  [P.ordered]: [P.partiallyReceived, P.received, P.cancelled],
  [P.partiallyReceived]: [P.partiallyReceived, P.received],
  [P.received]: [],
  [P.rejected]: [],
  [P.cancelled]: [],
});

const lineSchema = new Schema({
  book: { type: Types.ObjectId, ref: "Book", default: null }, // required before ordering
  title: String, // free text for requests of titles not yet catalogued
  isbn: String,
  quantity: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, min: 0, default: 0 }, // minor units
  received: { type: Number, default: 0, min: 0 },
});

const deliverySchema = new Schema(
  {
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: Types.ObjectId, ref: "User" },
    branch: { type: Types.ObjectId, ref: "Branch" },
    reference: String, // supplier's delivery note / invoice number
    lines: [{ _id: false, line: Types.ObjectId, quantity: Number, copies: [{ type: Types.ObjectId, ref: "Copy" }] }],
  },
  { _id: true }
);

const documentSchema = new Schema(
  { key: String, name: String, mimeType: String, size: Number, uploadedAt: { type: Date, default: Date.now }, uploadedBy: Types.ObjectId },
  { _id: true }
);

/** A purchase request that becomes a purchase order and is received in deliveries. */
const purchaseOrderSchema = new Schema(
  {
    number: { type: String, unique: true, sparse: true }, // assigned when ordered
    status: { type: String, enum: Object.values(P), default: P.requested },
    branch: { type: Types.ObjectId, ref: "Branch", required: true }, // receiving branch
    supplier: { type: Types.ObjectId, ref: "Supplier", default: null },
    currency: { type: String, required: true },
    lines: { type: [lineSchema], validate: (lines) => lines.length > 0 },
    deliveries: [deliverySchema],
    documents: [documentSchema],
    notes: String,
    requestedBy: { type: Types.ObjectId, ref: "User" },
    approvedBy: { type: Types.ObjectId, ref: "User" },
    orderedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ status: 1, createdAt: -1 });
purchaseOrderSchema.index({ branch: 1, status: 1 });
purchaseOrderSchema.index({ supplier: 1, createdAt: -1 });

export const purchaseOrderModel = mongoose.models.PurchaseOrder || model("PurchaseOrder", purchaseOrderSchema);
