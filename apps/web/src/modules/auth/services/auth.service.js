import { apiClient, refreshAccessToken, responseData } from "../../../lib/api-client.js";

export const login = (credentials) =>
  responseData(apiClient.post("/auth/login", credentials, { withCredentials: true }));

export const logout = () =>
  responseData(apiClient.post("/auth/logout", {}, { withCredentials: true }));

export async function restoreSession() {
  try {
    return await refreshAccessToken();
  } catch (error) {
    if (error?.response?.status === 401) return null;
    throw error;
  }
}

export const signup = (user) => responseData(apiClient.post("/auth/signup", user));

/** The signed-in account with the permissions its role grants. */
export const getCurrentUser = async () => (await responseData(apiClient.get("/auth/me"))).user;
