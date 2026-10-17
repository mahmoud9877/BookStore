import mongoose, { model, Schema, Types } from "mongoose";

export const ORDER_STATUSES = Object.freeze({
  waitPayment: "waitPayment",
  placed: "placed",
  canceled: "canceled",
  rejected: "rejected",
  onWay: "onWay",
  delivered: "delivered",
});

const orderSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Types.ObjectId, ref: "User" },
    address: { type: String, required: true },
    phone: { type: [String], required: true },
    note: { type: String },
    books: [
      {
        bookTitle: { type: String, required: true },
        bookId: { type: Types.ObjectId, ref: "Book", required: true },
        quantity: { type: Number, required: true, default: 1 },
        unitPrice: { type: Number, required: true, default: 1 },
        finalPrice: { type: Number, required: true, default: 1 },
      },
    ],
    subtotal: { type: Number, required: true, default: 1 },
    finalPrice: { type: Number, required: true, default: 1 },
    paymentType: {
      type: String,
      default: "cash",
      enum: ["cash", "card"],
      required: true,
    },
    status: {
      type: String,
      default: ORDER_STATUSES.placed,
      enum: Object.values(ORDER_STATUSES),
    },
    reason: String,
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const orderModel = mongoose.models.Order || model("Order", orderSchema);

export default orderModel;
