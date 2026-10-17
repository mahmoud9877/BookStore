import mongoose, { Schema, Types, model } from "mongoose";

const bookSchema = new Schema(
  {
    bookTitle: {
      type: String,
      required: [true, "Title is required"],
      set: (value) => value.toLowerCase(),
    },
    author: {
      type: String,
      required: [true, "Author is required"],
      trim: true,
      set: (value) => value.toLowerCase(),
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    image: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
    },
    // Units in stock; decremented when an order is placed.
    quantity: {
      type: Number,
      required: true,
    },
    likes: [{ type: Types.ObjectId, ref: "User" }],
    totalLikes: {
      type: Number,
      default: 0,
    },
    // Category name (not an ObjectId reference).
    category: {
      type: String,
      required: [true, "Category name is required"],
    },
  },
  {
    timestamps: true,
  }
);

const bookModel = mongoose.models.Book || model("Book", bookSchema);
export default bookModel;
