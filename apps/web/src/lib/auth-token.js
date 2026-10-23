import { jwtDecode } from "jwt-decode";

let accessToken = null;

export const getAuthToken = () => accessToken;
export const setAuthToken = (token) => {
  accessToken = token;
};
export const clearAuthToken = () => {
  accessToken = null;
};

/**
 * Returns the decoded claims of the in-memory access token plus the token, or null
 * when there is no usable token. Expired access tokens remain available so an
 * API request can renew the session through the HttpOnly refresh cookie.
 */
export function readSession() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const claims = jwtDecode(token);
    return { ...claims, token };
  } catch {
    clearAuthToken();
    return null;
  }
}
