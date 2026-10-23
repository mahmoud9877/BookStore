import { create } from "zustand";
import { clearAuthToken, readSession, setAuthToken } from "../../../lib/auth-token.js";

/**
 * The signed-in user (decoded JWT claims + token), or null. The token in
 * memory is the source of truth; the refresh token stays in an HttpOnly cookie.
 */
export const useAuthStore = create((set) => ({
  user: readSession(),

  signIn(token) {
    setAuthToken(token);
    set({ user: readSession() });
  },

  signOut() {
    clearAuthToken();
    set({ user: null });
  },

  /** Re-decodes the in-memory token after a refresh. */
  syncSession() {
    set({ user: readSession() });
  },
}));

export const selectUser = (state) => state.user;
export const selectIsSignedIn = (state) => Boolean(state.user);

window.addEventListener("auth-token-refreshed", () => useAuthStore.getState().syncSession());
