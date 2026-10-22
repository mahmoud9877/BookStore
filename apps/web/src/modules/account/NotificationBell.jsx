import React from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../lib/resource.js";
import { accountKeys } from "./account.queries.js";

/** Bell with the signed-in user's unread in-app notifications (refreshed every minute). */
export default function NotificationBell() {
  const { data: unread = 0 } = useQuery({
    queryKey: [...accountKeys.notifications(), "unread"],
    queryFn: async () => (await fetchJson("/notifications/me", { limit: 1, unreadOnly: true })).unread ?? 0,
    refetchInterval: 60_000,
  });
  return (
    <NavLink
      to="/account/notifications"
      className="nav-link cart-link px-2"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <i className="bi bi-bell fs-5" aria-hidden="true"></i>
      {unread > 0 && (
        <span className="cart-count" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </NavLink>
  );
}
