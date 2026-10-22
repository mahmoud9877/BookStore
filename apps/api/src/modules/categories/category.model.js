import mongoose, { model, Schema } from "mongoose";

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  { timestamps: true }
);

// A category has many books (books.category references categories._id).
categorySchema.virtual("books", {
  ref: "Book",
  localField: "_id",
  foreignField: "category",
});

const categoryModel =
  mongoose.models.Category || model("Category", categorySchema);

export { categoryModel };
