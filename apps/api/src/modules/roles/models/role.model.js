import mongoose, { model, Schema } from "mongoose";
import { ALL_PERMISSIONS, BRANCH_SCOPES } from "../constants/permissions.js";

// Custom roles only; the built-in Admin and User roles are defined in system-roles.js.
const roleSchema = new Schema(
  {
    // Stored on users.role, so it cannot change after creation.
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    permissions: [{ type: String, enum: ALL_PERMISSIONS }],
    // Whether branch-specific permissions apply to every branch or only to the
    // account's assigned branches (users.branches).
    branchScope: {
      type: String,
      enum: Object.values(BRANCH_SCOPES),
      default: BRANCH_SCOPES.assigned,
    },
  },
  { timestamps: true }
);

const roleModel = mongoose.models.Role || model("Role", roleSchema);

export { roleModel };
