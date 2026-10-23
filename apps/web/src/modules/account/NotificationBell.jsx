import React, { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, fetchJson, useApiMutation } from "../../lib/resource.js";
import { formatDateTime } from "../../lib/format.js";
import { useDismiss } from "../../layouts/UserMenu.jsx";
import { accountKeys } from "./account.queries.js";
import { notificationText } from "./notification-text.js";
import { t } from "../../i18n/index.js";

const LATEST_COUNT = 5;
// The notification stream keeps the count live; this is the fallback when it's down.
const FALLBACK_REFRESH_MS = 5 * 60_000;

/**
 * Bell with the signed-in user's unread count. It opens a dropdown with the latest
 * notifications, "Mark all as read" and a link to the inbox.
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss(menuRef, isOpen, close, toggleRef);
  const navigate = useNavigate();

  const { data: unread = 0 } = useQuery({
    queryKey: accountKeys.unreadNotifications(),
    queryFn: async () => (await fetchJson("/notifications/me", { limit: 1, unreadOnly: true })).unread ?? 0,
    refetchInterval: FALLBACK_REFRESH_MS,
  });
  const latest = useQuery({
    queryKey: accountKeys.latestNotifications(),
    queryFn: async () => (await fetchJson("/notifications/me", { limit: LATEST_COUNT })).data ?? [],
    enabled: isOpen,
  });
  const markRead = useApiMutation((ids) => apiClient.post("/notifications/me/read", ids ? { ids } : {}), {
    invalidate: [accountKeys.notifications()],
  });

  const open = (item, link) => {
    if (!item.readAt) markRead.mutate([item._id]);
    close();
    navigate(link ?? "/account/notifications");
  };
  const items = latest.data ?? [];

  return (
    <div className="dropdown notification-menu" ref={menuRef}>
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-ghost cart-link px-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="notification-menu"
        aria-label={unread ? t("Notifications, {count} unread", { count: unread }) : t("Notifications")}
        onClick={() => setIsOpen((value) => !value)}
      >
        <i className="bi bi-bell fs-5" aria-hidden="true"></i>
        {unread > 0 && (
          <span className="cart-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {isOpen && (
        <div id="notification-menu" className="dropdown-menu dropdown-menu-end show p-0 notification-menu-panel">
          <div className="d-flex align-items-center justify-content-between gap-2 px-3 py-2 border-bottom">
            <span className="fw-semibold">{t("Notifications")}</span>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => markRead.mutate(undefined)} disabled={!unread || markRead.isPending}>
              {t("Mark all as read")}
            </button>
          </div>
          {latest.isLoading ? (
            <p className="small text-muted px-3 py-3 mb-0" aria-busy="true">
              {t("Loading…")}
            </p>
          ) : latest.error ? (
            <p className="small text-danger px-3 py-3 mb-0">{t("Couldn't load your notifications.")}</p>
          ) : items.length === 0 ? (
            <p className="small text-muted px-3 py-3 mb-0">{t("No notifications yet")}</p>
          ) : (
            <ul className="list-unstyled mb-0" aria-label={t("Latest notifications")}>
              {items.map((item) => {
                const { title, body, link } = notificationText(item);
                return (
                  <li key={item._id}>
                    <button type="button" className={`dropdown-item notification-menu-item ${item.readAt ? "" : "is-unread"}`} onClick={() => open(item, link)}>
                      <span className={`d-block text-truncate ${item.readAt ? "" : "fw-semibold"}`}>
                        {!item.readAt && <span className="visually-hidden">{t("Unread:")} </span>}
                        {title}
                      </span>
                      <span className="d-block small text-muted notification-menu-body">{body}</span>
                      <span className="d-block small text-muted">{formatDateTime(item.createdAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-top text-center">
            <Link className="dropdown-item text-center small py-2" to="/account/notifications" onClick={close}>
              {t("See all notifications")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
