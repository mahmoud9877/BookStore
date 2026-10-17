import mongoose, { Schema, model } from "mongoose";

const bookSchema = new Schema(
  {
    bookTitle: {
      type: String,
      required: [true, "Title is required"],
      min: [2, "Minimum length is 2 characters"],
      max: [100, "Maximum length is 100 characters"],
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

    quantity: {
      type: Number,
      required: true,
    },
    totalLikes: {
      type: Number,
      default: 0,
    },
    category: {
      type: String, // Changed from ObjectId to String to store category name directly
      required: [true, "Category name is required"],
    },
    changePasswordTime: Date,
  },
  {
    timestamps: true,
  }
);

const bookModel = mongoose.models.Book || model("Book", bookSchema);
export default bookModel;
