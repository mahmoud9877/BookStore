import { apiClient } from "../../lib/api-client.js";

export const login = async (credentials) =>
  (await apiClient.post("/auth/login", credentials)).data;

export const signup = async (user) => (await apiClient.post("/auth/signup", user)).data;
