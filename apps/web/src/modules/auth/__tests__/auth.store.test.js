import { makeToken } from "../../../test-utils/make-token.js";
import { resetStores } from "../../../test-utils/reset-stores.js";
import { getAuthToken } from "../../../lib/auth-token.js";
import { selectIsSignedIn, useAuthStore } from "../stores/auth.store.js";

beforeEach(() => {
  localStorage.clear();
  resetStores();
});

test("signIn keeps the token in memory and exposes the decoded user", () => {
  useAuthStore.getState().signIn(makeToken({ userName: "reader", role: "Admin" }));
  const state = useAuthStore.getState();
  expect(state.user).toMatchObject({ userName: "reader", role: "Admin" });
  expect(selectIsSignedIn(state)).toBe(true);
  expect(getAuthToken()).toBeTruthy();
  expect(localStorage.getItem("userToken")).toBeNull();
});

test("signOut clears the session", () => {
  useAuthStore.getState().signIn(makeToken());
  useAuthStore.getState().signOut();
  expect(useAuthStore.getState().user).toBeNull();
  expect(getAuthToken()).toBeNull();
});

test("tokens are not shared between tabs through local storage", () => {
  useAuthStore.getState().signIn(makeToken());
  localStorage.setItem("unrelated", "value");
  window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
  expect(useAuthStore.getState().user).not.toBeNull();
});
