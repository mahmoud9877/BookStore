import React from "react";
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { makeToken } from "./make-token.js";
import { resetStores } from "./reset-stores.js";
import { createQueryClient } from "../lib/query-client.js";
import { useAuthStore } from "../modules/auth/stores/auth.store.js";
import Toaster from "../components/ui/Toaster.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";

/**
 * Renders one page with the app's providers, signed in (`claims` go into the
 * token) at `path`. Pair with `jest.mock("../lib/api-client.js", ...)` or a
 * mocked service module to control API responses.
 * `route` is the route pattern (e.g. "/dashboard/members/:memberId").
 */
export function renderPage(element, { path = "/", route = path, claims = { role: "Admin", userName: "Staff" } } = {}) {
  localStorage.clear();
  resetStores();
  if (claims) useAuthStore.getState().signIn(makeToken(claims));
  else useAuthStore.getState().syncSession();
  const queryClient = createQueryClient({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>
      <Toaster />
      <ConfirmDialog />
    </QueryClientProvider>
  );
}

/**
 * A stand-in for apiClient: `routes` maps "GET /path" (query string ignored) to
 * a response body or a function (config) => body. Unknown calls reject with 404.
 */
export function fakeApi(routes) {
  const handle = (method) =>
    jest.fn(async (url, bodyOrConfig, maybeConfig) => {
      const key = `${method} ${url.split("?")[0]}`;
      const handler = routes[key];
      if (handler === undefined) {
        const error = new Error(`No fake for ${key}`);
        error.response = { status: 404, data: { message: `No fake for ${key}` } };
        throw error;
      }
      const config = method === "GET" || method === "DELETE" ? bodyOrConfig : maybeConfig;
      const data = typeof handler === "function" ? await handler({ body: bodyOrConfig, params: config?.params }) : handler;
      return { data };
    });
  return { get: handle("GET"), post: handle("POST"), put: handle("PUT"), patch: handle("PATCH"), delete: handle("DELETE") };
}
