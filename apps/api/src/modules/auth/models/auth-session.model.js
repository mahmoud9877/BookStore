import mongoose, { Schema, model } from "mongoose";

const authSessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export const authSessionModel =
  mongoose.models.AuthSession || model("AuthSession", authSessionSchema);
