import mongoose, { model, Schema } from "mongoose";

const CATEGORY_OPTIONS = [
  "fiction",
  "non-fiction",
  "science",
  "biography",
  "fantasy",
];

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

const categoryModel =
  mongoose.models.Category || model("Category", categorySchema);

export { categoryModel, CATEGORY_OPTIONS };
