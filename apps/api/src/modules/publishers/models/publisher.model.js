import mongoose, { Schema, model } from "mongoose";
import { normalizeName } from "../../authors/models/author.model.js";

const publisherSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true },
    website: String,
    country: String,
  },
  { timestamps: true }
);

export const publisherModel = mongoose.models.Publisher || model("Publisher", publisherSchema);
