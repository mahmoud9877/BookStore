import axios from "axios";
import { getAuthToken, setAuthToken } from "./auth-token.js";
import { currentLanguage, t } from "../i18n/index.js";
import { API_BASE_URL, BEARER_KEY } from "../config/api.js";

export const apiClient = axios.create({ baseURL: API_BASE_URL });
let refreshRequest = null;

export function refreshAccessToken() {
  refreshRequest ??= axios
    .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
    .then(({ data }) => {
      const token = data.accessToken ?? data.token;
      if (!token) throw new Error("Token refresh response did not include an access token");
      setAuthToken(token);
      window.dispatchEvent(new CustomEvent("auth-token-refreshed", { detail: token }));
      return token;
    })
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.authorization = `${BEARER_KEY}${token}`;
  }
  // The API answers errors and validation messages in the interface language.
  config.headers["accept-language"] = currentLanguage();
  return config;
});

let unauthorizedHandler = null;

/**
 * Registers what happens when a signed-in request comes back 401 (expired token,
 * deactivated account): the app signs the user out and says why.
 */
export const onSessionExpired = (handler) => {
  unauthorizedHandler = handler;
};

apiClient.interceptors.response.use(undefined, (error) => {
  const config = error?.config;
  const sentToken = Boolean(config?.headers?.authorization);
  const shouldRefresh =
    error?.response?.status === 401 &&
    sentToken &&
    !config._retry &&
    !config.url?.includes("/auth/refresh") &&
    !config.url?.includes("/auth/login");

  if (shouldRefresh) {
    config._retry = true;
    return refreshAccessToken().then(
      (token) => {
        config.headers.authorization = `${BEARER_KEY}${token}`;
        return apiClient(config);
      },
      (refreshError) => {
        if ([401, 403].includes(refreshError?.response?.status) && unauthorizedHandler) {
          unauthorizedHandler(refreshError.response.data?.message);
        }
        return Promise.reject(error);
      }
    );
  }

  if (error?.response?.status === 401 && sentToken && unauthorizedHandler) {
    unauthorizedHandler(error.response.data?.message);
  }
  return Promise.reject(error);
});

/** Resolves the response body of an axios request. */
export const responseData = async (request) => (await request).data;

/** Extracts a user-facing message from an API error response. */
export function getErrorMessage(error, fallback = t("Something went wrong. Please try again.")) {
  const data = error?.response?.data;
  if (data?.message === "validationErr" && Array.isArray(data.validationErr)) {
    return data.validationErr.map((detail) => detail.message).join(", ");
  }
  return data?.message || data?.error || fallback;
}
