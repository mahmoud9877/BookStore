import { jwtDecode } from "jwt-decode";

// Existing sessions are stored under this key; do not rename it.
const TOKEN_STORAGE_KEY = "userToken";

export const getAuthToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);
export const setAuthToken = (token) => localStorage.setItem(TOKEN_STORAGE_KEY, token);
export const clearAuthToken = () => localStorage.removeItem(TOKEN_STORAGE_KEY);

/**
 * Returns the decoded claims of the stored token plus the token itself, or null
 * when there is no usable token. Malformed or expired tokens are discarded.
 */
export function readSession() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const claims = jwtDecode(token);
    if (claims.exp && claims.exp * 1000 <= Date.now()) {
      clearAuthToken();
      return null;
    }
    return { ...claims, token };
  } catch {
    clearAuthToken();
    return null;
  }
}
