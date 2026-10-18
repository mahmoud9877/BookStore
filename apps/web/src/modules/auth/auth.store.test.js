import { makeToken } from "../../test-utils/make-token.js";
import { resetStores } from "../../test-utils/reset-stores.js";
import { selectIsAdmin, selectIsSignedIn, useAuthStore } from "./auth.store.js";

beforeEach(() => {
  localStorage.clear();
  resetStores();
});

test("signIn stores the token and exposes the decoded user", () => {
  useAuthStore.getState().signIn(makeToken({ userName: "reader", role: "Admin" }));
  const state = useAuthStore.getState();
  expect(state.user).toMatchObject({ userName: "reader", role: "Admin" });
  expect(selectIsSignedIn(state)).toBe(true);
  expect(selectIsAdmin(state)).toBe(true);
  expect(localStorage.getItem("userToken")).toBeTruthy();
});

test("signOut clears the session", () => {
  useAuthStore.getState().signIn(makeToken());
  useAuthStore.getState().signOut();
  expect(useAuthStore.getState().user).toBeNull();
  expect(localStorage.getItem("userToken")).toBeNull();
});

test("a sign-out in another tab signs this tab out too", () => {
  useAuthStore.getState().signIn(makeToken());
  localStorage.removeItem("userToken"); // what the other tab did
  window.dispatchEvent(new StorageEvent("storage", { key: "userToken" }));
  expect(useAuthStore.getState().user).toBeNull();
});
