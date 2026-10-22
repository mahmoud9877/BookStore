import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "./auth.service.js";
import { useAuthStore } from "./auth.store.js";

const NO_PERMISSIONS = [];
const selectUserId = (state) => state.user?.id;

/**
 * The signed-in account from the API. Permissions come from here, not from the
 * token, so a role change applies without signing in again.
 */
export function useCurrentUserQuery() {
  const userId = useAuthStore(selectUserId);
  return useQuery({
    queryKey: ["me", userId],
    queryFn: getCurrentUser,
    enabled: Boolean(userId),
  });
}

/** `{ permissions, isLoading, can(...anyOf) }` for the signed-in user (none when signed out). */
export function usePermissions() {
  const { data, isLoading } = useCurrentUserQuery();
  const permissions = data?.permissions ?? NO_PERMISSIONS;
  return {
    permissions,
    isLoading,
    can: (...anyOf) => anyOf.some((permission) => permissions.includes(permission)),
  };
}
