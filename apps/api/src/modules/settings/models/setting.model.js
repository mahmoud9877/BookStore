import mongoose, { Schema, model } from "mongoose";

// One document per settings key (currently only "library"); `value` is validated
// by LibrarySettingsDto before it is stored.
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const settingModel = mongoose.models.Setting || model("Setting", settingSchema);
