import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRole, deleteRole, listPermissions, listRoles, updateRole } from "./role.service.js";

export const roleKeys = {
  all: ["roles"],
  list: () => [...roleKeys.all, "list"],
  permissions: () => [...roleKeys.all, "permissions"],
};

export const useRolesQuery = (options) => useQuery({ queryKey: roleKeys.list(), queryFn: listRoles, ...options });

/** The permission catalogue changes with a deploy, not at runtime. */
export const usePermissionCatalogue = () =>
  useQuery({ queryKey: roleKeys.permissions(), queryFn: listPermissions, staleTime: Infinity });

/** Creates a role, or updates one when `roleId` is given. */
export function useSaveRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, role }) => (roleId ? updateRole(roleId, role) : createRole(role)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: roleKeys.all }),
        // The signed-in user's own role may have changed.
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ]),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
