import mongoose, { Schema, model } from "mongoose";

const authorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Lowercase, single-spaced name: what makes two author records "the same".
    normalizedName: { type: String, required: true, unique: true },
    bio: String,
  },
  { timestamps: true }
);

export const normalizeName = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();

export const authorModel = mongoose.models.Author || model("Author", authorSchema);
