import mongoose, { Schema, Types, model } from "mongoose";

const cartSchema = new Schema({
  userId: { type: Types.ObjectId, required: true, ref: "User" },
  books: [
    {
      bookId: { type: Types.ObjectId, required: true, ref: "Book" },
      bookTitle: { type: String },
      quantity: { type: Number, required: true, min: 1 },
      image: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
    },
  ],
});

const cartModel = mongoose.models.Cart || model("Cart", cartSchema);
export default cartModel;
