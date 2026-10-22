import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roleKeys } from "../roles/role.queries.js";
import { changeUserRole, listUsers, updateUserAccess } from "./user.service.js";

export const userKeys = { all: ["users"], list: (params) => ["users", "list", params] };

export const useUsersQuery = (params) =>
  useQuery({ queryKey: userKeys.list(params), queryFn: () => listUsers(params), placeholderData: keepPreviousData });

export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }) => changeUserRole(userId, role),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
        // Roles show how many accounts hold them.
        queryClient.invalidateQueries({ queryKey: roleKeys.all }),
      ]),
  });
}

export function useUpdateUserAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, access }) => updateUserAccess(userId, access),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}
