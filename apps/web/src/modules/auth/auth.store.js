import { create } from "zustand";
import { TOKEN_STORAGE_KEY, clearAuthToken, readSession, setAuthToken } from "../../lib/auth-token.js";

/**
 * The signed-in user (decoded JWT claims + token), or null. The token in
 * localStorage is the source of truth; this store mirrors it.
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

  /** Re-reads the stored token, e.g. after another tab signed in or out. */
  syncFromStorage() {
    set({ user: readSession() });
  },
}));

export const selectUser = (state) => state.user;
export const selectIsSignedIn = (state) => Boolean(state.user);

// Signing in or out in one tab updates every open tab.
window.addEventListener("storage", (event) => {
  if (event.key === null || event.key === TOKEN_STORAGE_KEY) useAuthStore.getState().syncFromStorage();
});
