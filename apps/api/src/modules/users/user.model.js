import mongoose, { Schema, model } from "mongoose";
import { USER_ROLES } from "./user.roles.js";

const userSchema = new Schema(
  {
    userName: {
      type: String,
      required: [true, "userName is required"],
    },
    email: {
      type: String,
      lowercase: true,
      unique: [true, "email must be unique value"],
      required: [true, "email is required"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "password is required"],
    },
    phone: String,
    address: String,
    role: {
      type: String,
      default: USER_ROLES.User,
      enum: Object.values(USER_ROLES),
    },
    confirmEmail: {
      type: Boolean,
      default: false,
    },
    image: Object,
    DOB: String,
    code: { type: Number, default: null },
    changePasswordTime: Date,
  },
  {
    timestamps: true,
  }
);

const userModel = mongoose.models.User || model("User", userSchema);
export default userModel;
