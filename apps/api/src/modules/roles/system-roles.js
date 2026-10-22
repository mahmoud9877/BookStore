import { ALL_PERMISSIONS, BRANCH_SCOPES } from "./permissions.js";
import { USER_ROLES } from "../users/user.roles.js";

/**
 * Built-in roles. They live in code, not in the roles collection, so they can
 * never be edited, deleted or lost: Admin always holds every permission and
 * User (every new account) holds none.
 */
export const SYSTEM_ROLES = Object.freeze([
  {
    name: USER_ROLES.Admin,
    description: "Full access to every administration feature.",
    permissions: ALL_PERMISSIONS,
    branchScope: BRANCH_SCOPES.all,
    isSystem: true,
  },
  {
    name: USER_ROLES.User,
    description: "Customer account: browse, buy and track orders.",
    permissions: Object.freeze([]),
    branchScope: BRANCH_SCOPES.assigned,
    isSystem: true,
  },
]);

export const findSystemRole = (name) =>
  SYSTEM_ROLES.find((role) => role.name.toLowerCase() === String(name).toLowerCase());
