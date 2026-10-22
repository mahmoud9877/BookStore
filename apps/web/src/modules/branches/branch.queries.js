import { useDataQuery, usePagedQuery } from "../../lib/resource.js";

const NO_BRANCHES = [];

/** Active branches (public): pickup choices, filters, forms. */
export function useActiveBranches() {
  const query = useDataQuery(["branches", "active"], "/branches/active", undefined, { staleTime: 5 * 60_000 });
  return { ...query, data: query.data ?? NO_BRANCHES };
}

const NO_LOCATIONS = [];

/** Rooms and shelves of a branch (none until a branch is chosen). */
export function useLocations(branchId) {
  const query = usePagedQuery(["locations", "branch"], "/locations", { branch: branchId, limit: 100, sort: "code" }, { enabled: Boolean(branchId) });
  return { ...query, data: query.data?.data ?? NO_LOCATIONS };
}
