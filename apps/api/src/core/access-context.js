import { ForbiddenError } from "./http-errors.js";

/**
 * What the signed-in account may do: its permissions and the branches they
 * apply to. Built by the AuthGuard (req.access) and passed to services, which
 * enforce branch-level rules with `assertBranch()` and `branchFilter()`.
 */
export class AccessContext {
  constructor({ userId, userName, role, permissions = [], branchScope = "assigned", branches = [] }) {
    this.userId = userId;
    this.userName = userName;
    this.role = role;
    this.permissions = permissions;
    this.allBranches = branchScope === "all";
    this.branchIds = branches.map(String);
    Object.freeze(this);
  }

  can(...anyOf) {
    return anyOf.some((permission) => this.permissions.includes(permission));
  }

  canAccessBranch(branchId) {
    return this.allBranches || (branchId != null && this.branchIds.includes(String(branchId)));
  }

  /** Throws 403 unless the account may act on records of `branchId`. */
  assertBranch(branchId, message = "This record belongs to a branch you are not assigned to") {
    if (!this.canAccessBranch(branchId)) throw new ForbiddenError(message);
  }

  /** A MongoDB filter limiting `field` to the account's branches ({} for every branch). */
  branchFilter(field = "branch") {
    return this.allBranches ? {} : { [field]: { $in: this.branchIds } };
  }
}

/** Full access, for scheduled jobs and migrations that act on behalf of the system. */
export const SYSTEM_ACCESS = new AccessContext({ userId: null, userName: "system", role: "system", permissions: [], branchScope: "all" });
