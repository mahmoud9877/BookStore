import React, { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes.jsx";
import Toaster from "../components/ui/Toaster.jsx";
import { createQueryClient } from "../lib/query-client.js";
import QueryDevtools from "../components/QueryDevtools.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useForgetCartOnSignOut } from "../modules/cart/cart.queries.js";
import { NotificationStream } from "../modules/account/useNotificationStream.js";
import { onSessionExpired } from "../lib/api-client.js";
import { toast } from "../components/ui/toast.store.js";
import { useAuthStore } from "../modules/auth/auth.store.js";
import { t, useLanguage } from "../i18n/index.js";

/**
 * A signed-in request answered 401: the token expired or the account was
 * deactivated. Sign out once (protected pages then redirect to sign-in) and say why.
 */
function useSessionExpiry(queryClient) {
  useEffect(() => {
    onSessionExpired((message) => {
      if (!useAuthStore.getState().user) return;
      useAuthStore.getState().signOut();
      queryClient.clear();
      // The API message arrives already translated; match the English and Arabic wording.
      toast.error(/deactivated|إيقاف/i.test(message ?? "") ? t("This account has been deactivated.") : t("Your session has expired. Please sign in again."));
    });
    return () => onSessionExpired(null);
  }, [queryClient]);
}

/**
 * Server state (books, categories, cart) is cached by React Query; client state
 * (session, toasts, confirmations) lives in Zustand stores.
 * Hash routing keeps deep links working on static hosts (GitHub Pages, nginx).
 */
export default function App({ createRouter = createHashRouter, queryClient: providedClient }) {
  const [router] = useState(() => createRouter(routes));
  const [queryClient] = useState(() => providedClient ?? createQueryClient());
  useForgetCartOnSignOut(queryClient);
  useSessionExpiry(queryClient);
  // Re-render everything in the new language (and direction) when it changes;
  // the router, its location and the data cache are kept.
  const { language } = useLanguage();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider key={language} router={router} />
      <NotificationStream />
      <Toaster />
      <ConfirmDialog />
      <QueryDevtools />
    </QueryClientProvider>
  );
}
