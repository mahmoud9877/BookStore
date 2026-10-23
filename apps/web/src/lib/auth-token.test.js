import { makeToken } from "../test-utils/make-token.js";
import { clearAuthToken, getAuthToken, readSession, setAuthToken } from "./auth-token.js";

beforeEach(() => {
  localStorage.clear();
  clearAuthToken();
});

test("returns null without an in-memory access token", () => {
  expect(readSession()).toBeNull();
});

test("decodes the in-memory access token", () => {
  const token = makeToken({ userName: "reader", role: "Admin" });
  setAuthToken(token);
  expect(readSession()).toMatchObject({ userName: "reader", role: "Admin", token });
});

test("discards malformed tokens", () => {
  setAuthToken("not-a-jwt");
  expect(readSession()).toBeNull();
  expect(getAuthToken()).toBeNull();
});

test("keeps expired access tokens so the API client can refresh the session", () => {
  const token = makeToken({ exp: Date.now() / 1000 - 60 });
  setAuthToken(token);
  expect(readSession()).toMatchObject({ token });
  expect(getAuthToken()).toBe(token);
  expect(localStorage.getItem("userToken")).toBeNull();
});
