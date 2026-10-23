import mongoose, { Schema, Types, model } from "mongoose";
import { USER_ROLES } from "../constants/user.roles.js";

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
    // A built-in role (see roles/system-roles.js) or the name of a custom role.
    role: {
      type: String,
      default: USER_ROLES.User,
    },
    confirmEmail: {
      type: Boolean,
      default: false,
    },
    // Deactivated accounts cannot sign in or use existing tokens.
    isActive: {
      type: Boolean,
      default: true,
    },
    // Staff: the branches their role's branch-specific permissions apply to.
    branches: [{ type: Types.ObjectId, ref: "Branch" }],
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
