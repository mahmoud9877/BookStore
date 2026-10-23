import React, { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { routes } from "./routes.jsx";
import Toaster from "../components/ui/Toaster.jsx";
import { createQueryClient } from "../lib/query-client.js";
import QueryDevtools from "../components/QueryDevtools.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useForgetCartOnSignOut } from "../modules/cart/queries/cart.queries.js";
import { restoreSession } from "../modules/auth/services/auth.service.js";
import { NotificationStream } from "../modules/account/hooks/useNotificationStream.js";
import { onSessionExpired } from "../lib/api-client.js";
import { toast } from "../components/ui/toast.store.js";
import { useAuthStore } from "../modules/auth/stores/auth.store.js";
import { t, useLanguage } from "../i18n/index.js";
import PageLoader from "../components/ui/PageLoader.jsx";

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
  const [sessionReady, setSessionReady] = useState(() => Boolean(useAuthStore.getState().user));
  useForgetCartOnSignOut(queryClient);
  useSessionExpiry(queryClient);
  // Re-render everything in the new language (and direction) when it changes;
  // the router, its location and the data cache are kept.
  const { language } = useLanguage();

  useEffect(() => {
    if (useAuthStore.getState().user) return undefined;
    let mounted = true;
    Promise.resolve()
      .then(restoreSession)
      .then((token) => {
        if (mounted && token) useAuthStore.getState().signIn(token);
      })
      .catch((error) => {
        console.error(`[auth] session restore failed: ${error.message}`);
      })
      .finally(() => {
        if (mounted) setSessionReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        {sessionReady ? <RouterProvider key={language} router={router} /> : <PageLoader />}
        <NotificationStream />
        <Toaster />
        <ConfirmDialog />
        <QueryDevtools />
      </QueryClientProvider>
    </HelmetProvider>
  );
}
