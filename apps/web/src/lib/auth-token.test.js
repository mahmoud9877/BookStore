import { makeToken } from "../test-utils/make-token.js";
import { readSession, setAuthToken } from "./auth-token.js";

beforeEach(() => localStorage.clear());

test("returns null without a stored token", () => {
  expect(readSession()).toBeNull();
});

test("decodes a stored token", () => {
  const token = makeToken({ userName: "reader", role: "Admin" });
  setAuthToken(token);
  expect(readSession()).toMatchObject({ userName: "reader", role: "Admin", token });
});

test("discards malformed tokens", () => {
  setAuthToken("not-a-jwt");
  expect(readSession()).toBeNull();
  expect(localStorage.getItem("userToken")).toBeNull();
});
