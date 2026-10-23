import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "../../../components/ui/PageHeader.jsx";
import Pagination from "../../../components/ui/Pagination.jsx";
import StatePanel, { ErrorState } from "../../../components/ui/StatePanel.jsx";
import useListState from "../../../hooks/useListState.js";
import { getErrorMessage } from "../../../lib/api-client.js";
import { apiClient, fetchJson, useApiMutation, usePagedQuery } from "../../../lib/resource.js";
import { formatDateTime } from "../../../lib/format.js";
import { t } from "../../../i18n/index.js";
import { selectIsSignedIn, useAuthStore } from "../../auth/stores/auth.store.js";
import { accountKeys } from "../../account/queries/account.queries.js";

/** Upcoming public events with registration for signed-in members. */
export default function EventsPage() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const { params, setPage } = useListState({}, { limit: 12 });
  const events = usePagedQuery(["events", "public"], "/events/public", params);
  const mine = useQuery({ queryKey: accountKeys.events(), queryFn: async () => (await fetchJson("/events/me")).data, enabled: isSignedIn });
  const registeredIds = new Set((mine.data ?? []).map((event) => event._id));
  const invalidate = [["events"], accountKeys.events()];
  const register = useApiMutation((event) => apiClient.post(`/events/${event._id}/register`), {
    invalidate,
    success: (event) => t("You're registered for “{title}”.", { title: event.title }),
  });
  const unregister = useApiMutation((event) => apiClient.post(`/events/${event._id}/unregister`), { invalidate, success: t("Registration cancelled.") });
  const items = events.data?.data ?? [];

  return (
    <div className="container">
      <PageHeader title={t("Events")} description={t("Book clubs, talks and workshops at our branches.")} />
      {events.isLoading ? (
        <p className="text-muted" aria-busy="true">
          {t("Loading events…")}
        </p>
      ) : events.error ? (
        <ErrorState message={getErrorMessage(events.error, t("Couldn't load events."))} onRetry={events.refetch} />
      ) : items.length === 0 ? (
        <StatePanel icon="calendar-event" title={t("No upcoming events")} message={t("Check back soon.")} />
      ) : (
        <>
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
            {items.map((event) => {
              const full = event.registered >= event.capacity;
              const registered = registeredIds.has(event._id);
              return (
                <div className="col" key={event._id}>
                  <article className="card h-100">
                    <div className="card-body d-flex flex-column">
                      <h2 className="h5">{event.title}</h2>
                      <div className="small text-muted mb-2">
                        <i className="bi bi-calendar3 me-1" aria-hidden="true"></i>
                        {formatDateTime(event.startAt)} · {event.branch?.name}
                        {event.room?.name && `, ${event.room.name}`}
                      </div>
                      {event.description && <p className="small">{event.description}</p>}
                      <div className="small text-muted mt-auto mb-2">
                        {t("{left} of {capacity} places left", { left: event.capacity - event.registered, capacity: event.capacity })}
                      </div>
                      {!isSignedIn ? (
                        <Link to="/login" className="btn btn-sm btn-outline-primary">
                          {t("Sign in to register")}
                        </Link>
                      ) : registered ? (
                        <button type="button" className="btn btn-sm btn-light" onClick={() => unregister.mutate(event)} disabled={unregister.isPending}>
                          <i className="bi bi-check2 me-1" aria-hidden="true"></i>{t("Registered — cancel")}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => register.mutate(event)} disabled={full || register.isPending}>
                          {full ? t("Full") : t("Register for {title}", { title: event.title })}
                        </button>
                      )}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
          <Pagination meta={events.data?.meta} onPageChange={setPage} label={t("Event pages")} />
        </>
      )}
    </div>
  );
}
