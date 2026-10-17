import mongoose from "mongoose";

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  books: [
    {
      bookId: {
        type: mongoose.Schema.Types.ObjectId, // Assuming bookId is an ObjectId
        required: true,
        ref: "Book", // Reference to the Book model
      },
      bookTitle: {
        type: String,
      },
      image: {
        type: String,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1, // Minimum quantity should be at least 1
      },
      image: {
        type: String,
        required: true, // Assuming image is a URL string
      },
      price: {
        type: Number,
        required: true,
        min: 0, // Price should not be negative
      },
    },
  ],
});

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
