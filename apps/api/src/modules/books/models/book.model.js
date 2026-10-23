import mongoose, { Schema, Types, model } from "mongoose";

/**
 * A bibliographic record: one edition of a title (with its ISBN). Physical
 * copies that can be lent live in the `copies` collection; `price`/`quantity`
 * are the shop's selling price and stock, used only when `isForSale`.
 */
const bookSchema = new Schema(
  {
    bookTitle: {
      type: String,
      required: [true, "Title is required"],
      set: (value) => value.toLowerCase(),
    },
    // Display string of the authors' names, kept in sync with `authors`.
    author: {
      type: String,
      required: [true, "Author is required"],
      trim: true,
      set: (value) => value.toLowerCase(),
    },
    authors: [{ type: Types.ObjectId, ref: "Author" }],
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    image: {
      type: String,
    },
    isbn: { type: String, trim: true },
    edition: { type: String, trim: true }, // e.g. "2nd", "Revised"
    publisher: { type: Types.ObjectId, ref: "Publisher", default: null },
    publicationYear: Number,
    language: { type: String, trim: true, lowercase: true },
    pageCount: Number,
    subjects: [{ type: String, lowercase: true, trim: true }],
    keywords: [{ type: String, lowercase: true, trim: true }],
    // Groups the editions of one title: normalized title + first author.
    workKey: { type: String, index: true },
    isForSale: { type: Boolean, default: true },
    price: {
      type: Number,
      required: [true, "Price is required"],
    },
    // Percent off `price` (0 = none) until `discountEndsAt` (null = no end). See book-pricing.js.
    discountPercent: { type: Number, default: 0, min: 0, max: 90 },
    discountEndsAt: { type: Date, default: null },
    // Units in the shop's stock; decremented when an order is placed. Not lending copies.
    quantity: {
      type: Number,
      required: true,
    },
    likes: [{ type: Types.ObjectId, ref: "User" }],
    totalLikes: {
      type: Number,
      default: 0,
    },
    // Each book belongs to one category; a category has many books.
    category: {
      type: Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// An ISBN identifies exactly one edition.
bookSchema.index({ isbn: 1 }, { unique: true, partialFilterExpression: { isbn: { $type: "string" } } });
bookSchema.index({ authors: 1 });
bookSchema.index({ publisher: 1 });
bookSchema.index({ subjects: 1 });
bookSchema.index({ createdAt: -1 });
bookSchema.index(
  { bookTitle: "text", author: "text", subjects: "text", keywords: "text", description: "text" },
  { weights: { bookTitle: 10, author: 6, subjects: 4, keywords: 4, description: 1 }, name: "book_text" }
);

export const workKeyOf = (title, author) =>
  `${String(title).trim().toLowerCase().replace(/\s+/g, " ")}|${String(author).split(",")[0].trim().toLowerCase()}`;

const bookModel = mongoose.models.Book || model("Book", bookSchema);
export default bookModel;
