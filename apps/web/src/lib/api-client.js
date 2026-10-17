import axios from "axios";
import { getAuthToken } from "./auth-token.js";
import { API_BASE_URL, BEARER_KEY } from "../config/api.js";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.authorization = `${BEARER_KEY}${token}`;
  }
  return config;
});

/** Resolves the response body of an axios request. */
export const responseData = async (request) => (await request).data;

/** Extracts a user-facing message from an API error response. */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const data = error?.response?.data;
  if (data?.message === "validationErr" && Array.isArray(data.validationErr)) {
    return data.validationErr.map((detail) => detail.message).join(", ");
  }
  return data?.message || data?.error || fallback;
}
