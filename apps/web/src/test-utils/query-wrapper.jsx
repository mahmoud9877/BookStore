import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "../lib/query-client.js";

/** A fresh retry-less QueryClient plus a wrapper for renderHook. */
export function createQueryWrapper() {
  const queryClient = createQueryClient({ queries: { retry: false } });
  const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}
