import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DataTable from "../../components/ui/DataTable.jsx";
import FormField from "../../components/ui/FormField.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, fetchJson, useApiMutation } from "../../lib/resource.js";
import { formatDate, formatDateTime, formatTime } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";
import { t, tp } from "../../i18n/index.js";

const HOUR = 3_600_000;
const today = () => new Date().toISOString().slice(0, 10);

/** Pick a room, a day and a time; busy slots for that day are shown before booking. */
function BookRoomForm() {
  const [form, setForm] = useState({ room: "", day: today(), start: "10:00", hours: "1", purpose: "" });
  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));
  const rooms = useQuery({ queryKey: ["rooms", "bookable"], queryFn: () => fetchJson("/rooms", { isActive: true, limit: 100 }), staleTime: 60_000 });
  const dayStart = new Date(`${form.day}T00:00`);
  const busy = useQuery({
    queryKey: ["rooms", form.room, "availability", form.day],
    enabled: Boolean(form.room && form.day),
    queryFn: async () =>
      (await fetchJson(`/rooms/${form.room}/availability`, { from: dayStart.toISOString(), to: new Date(dayStart.getTime() + 24 * HOUR).toISOString() })).data,
  });
  const book = useApiMutation(
    () => {
      const startAt = new Date(`${form.day}T${form.start}`);
      return apiClient.post("/rooms/bookings/me", {
        room: form.room,
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + Number(form.hours) * HOUR).toISOString(),
        purpose: form.purpose,
      });
    },
    { invalidate: [accountKeys.bookings(), ["rooms", form.room]], success: t("Room booked."), failure: t("Couldn't book the room.") }
  );

  return (
    <form
      className="card card-body mb-4"
      onSubmit={(event) => {
        event.preventDefault();
        book.mutate();
      }}
    >
      <h2 className="h5">{t("Book a study room")}</h2>
      <div className="row g-2">
        <div className="col-md-4">
          <FormField label={t("Room")} as="select" className="" value={form.room} onChange={set("room")} required>
            <option value="">{t("Choose a room…")}</option>
            {(rooms.data?.data ?? []).map((room) => (
              <option key={room._id} value={room._id}>
                {room.name} · {room.branch?.name} ({tp("seat", room.capacity)})
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-6 col-md-3">
          <FormField label={t("Day")} type="date" min={today()} className="" value={form.day} onChange={set("day")} required />
        </div>
        <div className="col-6 col-md-2">
          <FormField label={t("From")} type="time" step="900" className="" value={form.start} onChange={set("start")} required />
        </div>
        <div className="col-6 col-md-3">
          <FormField label={t("Hours")} as="select" className="" value={form.hours} onChange={set("hours")}>
            {[1, 2, 3, 4].map((hours) => (
              <option key={hours} value={hours}>
                {tp("hour", hours)}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-md-9">
          <FormField label={t("Purpose (optional)")} className="" maxLength={300} value={form.purpose} onChange={set("purpose")} />
        </div>
        <div className="col-md-3 d-flex align-items-end">
          <button type="submit" className="btn btn-primary w-100" disabled={!form.room || book.isPending}>
            {book.isPending ? <Spinner label={t("Booking")} /> : t("Book room")}
          </button>
        </div>
      </div>
      {form.room && (
        <p className="small text-muted mt-2 mb-0" aria-live="polite">
          {busy.isLoading
            ? t("Checking availability…")
            : busy.data?.length
              ? t("Already booked on {date}: {slots}", {
                  date: formatDate(dayStart),
                  slots: busy.data.map((slot) => `${formatTime(slot.startAt)}–${formatTime(slot.endAt)}`).join(t(", ")),
                })
              : t("Free all day on {date}.", { date: formatDate(dayStart) })}
        </p>
      )}
    </form>
  );
}

/** Room bookings and event registrations. */
export default function MyBookingsPage() {
  const bookings = useQuery({ queryKey: accountKeys.bookings(), queryFn: async () => (await fetchJson("/rooms/bookings/me")).data });
  const events = useQuery({ queryKey: accountKeys.events(), queryFn: async () => (await fetchJson("/events/me")).data });
  const cancelBooking = useApiMutation((booking) => apiClient.post(`/rooms/bookings/me/${booking._id}/cancel`, {}), {
    invalidate: [accountKeys.bookings()],
    success: t("Booking cancelled."),
  });
  const unregister = useApiMutation((event) => apiClient.post(`/events/${event._id}/unregister`), {
    invalidate: [accountKeys.events(), ["events"]],
    success: t("You are no longer registered."),
  });

  async function confirmCancel(booking) {
    if (await confirm({
        title: t("Cancel this booking?"),
        message: t("{room}, {date}.", { room: booking.room?.name, date: formatDateTime(booking.startAt) }),
        confirmLabel: t("Cancel booking"),
      })) {
      cancelBooking.mutate(booking);
    }
  }
  async function confirmUnregister(event) {
    if (await confirm({
        title: t("Leave this event?"),
        message: t("“{title}” on {date}.", { title: event.title, date: formatDateTime(event.startAt) }),
        confirmLabel: t("Unregister"),
      })) {
      unregister.mutate(event);
    }
  }

  const upcoming = (booking) => booking.status === "confirmed" && new Date(booking.startAt) > new Date();

  return (
    <>
      <BookRoomForm />
      <h2 className="h5">{t("My room bookings")}</h2>
      <DataTable
        caption={t("Room bookings")}
        query={bookings}
        rows={bookings.data ?? []}
        empty={{ icon: "door-open", title: t("No room bookings") }}
        columns={[
          { key: "room", header: t("Room"), render: (booking) => <>{booking.room?.name}<div className="small text-muted">{booking.branch?.name}</div></> },
          { key: "when", header: t("When"), render: (booking) => `${formatDateTime(booking.startAt)} – ${formatTime(booking.endAt)}` },
          { key: "status", header: t("Status"), hideBelow: "sm", render: (booking) => <StatusBadge status={booking.status} /> },
          {
            key: "actions",
            header: <span className="visually-hidden">{t("Actions")}</span>,
            className: "text-end",
            render: (booking) =>
              upcoming(booking) && (
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => confirmCancel(booking)} aria-label={t("Cancel booking of {room}", { room: booking.room?.name })}>
                  {t("Cancel")}
                </button>
              ),
          },
        ]}
      />
      <h2 className="h5 mt-4">{t("My events")}</h2>
      <DataTable
        caption={t("Event registrations")}
        query={events}
        rows={events.data ?? []}
        empty={{ icon: "calendar-event", title: t("You're not registered for any events"), action: <Link to="/events">{t("See upcoming events")}</Link> }}
        columns={[
          { key: "title", header: t("Event"), render: (event) => <>{event.title}<div className="small text-muted">{event.branch?.name}</div></> },
          { key: "when", header: t("When"), render: (event) => formatDateTime(event.startAt) },
          { key: "status", header: t("Status"), hideBelow: "sm", render: (event) => <StatusBadge status={event.status} /> },
          {
            key: "actions",
            header: <span className="visually-hidden">{t("Actions")}</span>,
            className: "text-end",
            render: (event) =>
              event.status === "scheduled" &&
              new Date(event.startAt) > new Date() && (
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => confirmUnregister(event)} aria-label={t("Unregister from {title}", { title: event.title })}>
                  {t("Unregister")}
                </button>
              ),
          },
        ]}
      />
    </>
  );
}
