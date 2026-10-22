import React from "react";
import Pagination from "../../components/ui/Pagination.jsx";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import useListState from "../../hooks/useListState.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../lib/resource.js";
import { formatDateTime } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";

/** The in-app inbox: messages about loans, reservations, fines and payments. */
export default function NotificationsPage() {
  const { filters, params, setFilter, setPage } = useListState({ unreadOnly: false });
  const inbox = usePagedQuery(accountKeys.notifications(), "/notifications/me", params);
  const markRead = useApiMutation((ids) => apiClient.post("/notifications/me/read", ids ? { ids } : {}), {
    invalidate: [accountKeys.notifications()],
  });
  const markAll = () => markRead.mutate(undefined);
  const items = inbox.data?.data ?? [];
  const unread = inbox.data?.unread ?? 0;

  return (
    <section aria-labelledby="inbox-title">
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <h2 id="inbox-title" className="h5 mb-0">
          Notifications {unread > 0 && <span className="badge text-bg-danger ms-1">{unread} unread</span>}
        </h2>
        <div className="d-flex gap-2 align-items-center">
          <div className="form-check form-switch mb-0">
            <input id="unread-only" className="form-check-input" type="checkbox" role="switch" checked={filters.unreadOnly} onChange={(event) => setFilter("unreadOnly", event.target.checked)} />
            <label className="form-check-label" htmlFor="unread-only">
              Unread only
            </label>
          </div>
          <button type="button" className="btn btn-sm btn-light" onClick={markAll} disabled={!unread || markRead.isPending}>
            Mark all as read
          </button>
        </div>
      </div>
      {inbox.isLoading ? (
        <p className="text-muted" aria-busy="true">
          Loading…
        </p>
      ) : inbox.error ? (
        <ErrorState message={getErrorMessage(inbox.error, "Couldn't load your notifications.")} onRetry={inbox.refetch} />
      ) : items.length === 0 ? (
        <StatePanel icon="bell" title={filters.unreadOnly ? "You're all caught up" : "No notifications yet"} />
      ) : (
        <div className="card">
          <ul className="list-group list-group-flush">
            {items.map((item) => (
              <li key={item._id} className={`list-group-item d-flex gap-3 ${item.readAt ? "" : "bg-body-tertiary"}`}>
                <i className={`bi bi-${item.readAt ? "envelope-open" : "envelope-fill text-primary"} mt-1`} aria-hidden="true"></i>
                <div className="flex-grow-1 min-w-0">
                  <div className={item.readAt ? "" : "fw-semibold"}>
                    {!item.readAt && <span className="visually-hidden">Unread: </span>}
                    {item.subject}
                  </div>
                  <p className="small text-muted mb-1" style={{ whiteSpace: "pre-line" }}>
                    {item.body}
                  </p>
                  <span className="small text-muted">{formatDateTime(item.createdAt)}</span>
                </div>
                {!item.readAt && (
                  <button type="button" className="btn btn-sm btn-ghost align-self-start" onClick={() => markRead.mutate([item._id])} aria-label={`Mark “${item.subject}” as read`}>
                    <i className="bi bi-check2" aria-hidden="true"></i>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Pagination meta={inbox.data?.meta} onPageChange={setPage} label="Notification pages" />
        </div>
      )}
    </section>
  );
}
