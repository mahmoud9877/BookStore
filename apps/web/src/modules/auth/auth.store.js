import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TOKEN_STORAGE_KEY, clearAuthToken, readSession, setAuthToken } from "../../lib/auth-token.js";

export const USER_ROLES = Object.freeze({ Admin: "Admin", User: "User" });

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
export const selectIsAdmin = (state) => state.user?.role === USER_ROLES.Admin;

/** `{ user, isAdmin }` for components that render account details. */
export const useCurrentUser = () =>
  useAuthStore(useShallow((state) => ({ user: selectUser(state), isAdmin: selectIsAdmin(state) })));

// Signing in or out in one tab updates every open tab.
window.addEventListener("storage", (event) => {
  if (event.key === null || event.key === TOKEN_STORAGE_KEY) useAuthStore.getState().syncFromStorage();
});
