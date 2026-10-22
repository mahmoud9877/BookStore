import { apiClient, responseData } from "../../lib/api-client.js";

/** Built-in roles first, then custom ones; each has `permissions` and `userCount`. */
export const listRoles = async () => (await responseData(apiClient.get("/role"))).roles ?? [];

/** `[{ key, label, description }]` in display order. */
export const listPermissions = async () => (await responseData(apiClient.get("/role/permissions"))).permissions ?? [];

export const createRole = (role) => responseData(apiClient.post("/role", role));

export const updateRole = (roleId, { description, permissions, branchScope }) =>
  responseData(apiClient.put(`/role/${roleId}`, { description, permissions, branchScope }));

export const deleteRole = (roleId) => apiClient.delete(`/role/${roleId}`);
