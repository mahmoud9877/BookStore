import { apiClient, responseData } from "../../../lib/api-client.js";
import { cleanParams } from "../../../lib/resource.js";

/** One page of accounts: `{ users, meta }` (`?page&limit&search&role`). */
export const listUsers = (params = {}) => responseData(apiClient.get("/auth/user", { params: cleanParams(params) }));

export const changeUserRole = async (userId, role) =>
  (await responseData(apiClient.patch(`/auth/user/${userId}/role`, { role }))).user;

/** `{ branches?, isActive? }` */
export const updateUserAccess = async (userId, access) =>
  (await responseData(apiClient.patch(`/auth/user/${userId}/access`, access))).user;
