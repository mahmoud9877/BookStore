import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes.jsx";
import Toaster from "../components/ui/Toaster.jsx";
import { createQueryClient } from "../lib/query-client.js";
import QueryDevtools from "../components/QueryDevtools.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useForgetCartOnSignOut } from "../modules/cart/cart.queries.js";

/**
 * Server state (books, categories, cart) is cached by React Query; client state
 * (session, toasts, confirmations) lives in Zustand stores.
 * Hash routing keeps deep links working on static hosts (GitHub Pages, nginx).
 */
export default function App({ createRouter = createHashRouter, queryClient: providedClient }) {
  const [router] = useState(() => createRouter(routes));
  const [queryClient] = useState(() => providedClient ?? createQueryClient());
  useForgetCartOnSignOut(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <ConfirmDialog />
      <QueryDevtools />
    </QueryClientProvider>
  );
}
