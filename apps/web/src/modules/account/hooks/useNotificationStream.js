import { createElement, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, BEARER_KEY } from "../../../config/api.js";
import { keepEventStreamOpen, openEventStream } from "../../../lib/event-stream.js";
import { toast } from "../../../components/ui/toast.store.js";
import { currentLanguage } from "../../../i18n/index.js";
import { useAuthStore } from "../../auth/stores/auth.store.js";
import { accountKeys } from "../queries/account.queries.js";
import { notificationText } from "../utils/notification-text.js";

const selectToken = (state) => state.user?.token;

const parse = (data) => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

/** Notification lists (inbox pages, the bell's dropdown), not the unread count. */
const isList = (query) => query.queryKey[accountKeys.notifications().length] !== "unread";

/**
 * Live notifications (GET /notifications/stream) while a user is signed in:
 * `unread` events update the bell's count, `notification` events show a toast and
 * refresh the lists. Reconnects with backoff; stops on sign-out and on 401 (the
 * next API call then signs the user out). Mount once for the whole app.
 */
export default function useNotificationStream() {
  const token = useAuthStore(selectToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return undefined;
    const unreadKey = accountKeys.unreadNotifications();
    const refreshLists = () => queryClient.invalidateQueries({ queryKey: accountKeys.notifications(), predicate: isList });

    const onEvent = ({ event, data }) => {
      const payload = parse(data);
      if (!payload) return;
      if (event === "unread" && typeof payload.unread === "number") {
        const previous = queryClient.getQueryData(unreadKey);
        queryClient.setQueryData(unreadKey, payload.unread);
        // Read elsewhere (another tab or device): the lists' read marks changed too.
        if (previous !== undefined && payload.unread < previous) refreshLists();
      } else if (event === "notification") {
        const { title, body } = notificationText(payload);
        toast.info(createElement("span", null, createElement("strong", { className: "d-block" }, title), body));
        refreshLists();
      }
    };

    return keepEventStreamOpen({
      getRequest: () => ({
        url: `${API_BASE_URL}/notifications/stream`,
        headers: { authorization: `${BEARER_KEY}${token}`, "accept-language": currentLanguage() },
      }),
      onEvent,
      // The session ended: re-checking the count goes through apiClient, whose 401 handler signs out.
      onUnauthorized: () => queryClient.invalidateQueries({ queryKey: unreadKey }),
      open: openEventStream,
    });
  }, [token, queryClient]);
}

/** Mounts the notification stream (renders nothing); place inside the QueryClientProvider. */
export function NotificationStream() {
  useNotificationStream();
  return null;
}
