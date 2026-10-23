import { BEARER_KEY } from "../config/api.js";
import { apiClient, getErrorMessage } from "./api-client.js";
import { clearAuthToken, setAuthToken } from "./auth-token.js";

const runRequestInterceptors = (config) =>
  apiClient.interceptors.request.handlers.reduce((current, { fulfilled }) => fulfilled(current), config);

beforeEach(() => {
  localStorage.clear();
  clearAuthToken();
});

test("prefixes the in-memory token with the bearer key and no space", () => {
  setAuthToken("abc.def.ghi");
  const config = runRequestInterceptors({ headers: {} });
  expect(config.headers.authorization).toBe(`${BEARER_KEY}abc.def.ghi`);
});

test("sends no authorization header when signed out", () => {
  expect(runRequestInterceptors({ headers: {} }).headers.authorization).toBeUndefined();
});

test("getErrorMessage prefers API messages and flattens validation errors", () => {
  expect(getErrorMessage({ response: { data: { message: "Empty Cart" } } })).toBe("Empty Cart");
  expect(getErrorMessage({ response: { data: { error: "Image file is required" } } })).toBe("Image file is required");
  expect(
    getErrorMessage({
      response: { data: { message: "validationErr", validationErr: [{ message: "a" }, { message: "b" }] } },
    })
  ).toBe("a, b");
  expect(getErrorMessage(new Error("network"), "fallback")).toBe("fallback");
});
