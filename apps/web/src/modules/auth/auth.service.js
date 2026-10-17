import { apiClient, responseData } from "../../lib/api-client.js";

export const login = (credentials) => responseData(apiClient.post("/auth/login", credentials));

export const signup = (user) => responseData(apiClient.post("/auth/signup", user));
