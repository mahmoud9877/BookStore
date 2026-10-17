import mongoose, { model, Schema, Types } from "mongoose";

const orderSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true }, // Removed 'unique: true'
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
      default: "placed",
      enum: [
        "waitPayment",
        "placed",
        "canceled",
        "rejected",
        "onWay",
        "delivered",
      ],
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
