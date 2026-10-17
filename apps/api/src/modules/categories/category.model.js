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

const categoryModel =
  mongoose.models.Category || model("Category", categorySchema);

export { categoryModel };
