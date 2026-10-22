import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DataTable from "../../components/ui/DataTable.jsx";
import FormField from "../../components/ui/FormField.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, fetchJson, useApiMutation } from "../../lib/resource.js";
import { formatDate, formatDateTime } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";

const HOUR = 3_600_000;
const today = () => new Date().toISOString().slice(0, 10);
const timeOf = (date) => new Date(date).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });

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
    { invalidate: [accountKeys.bookings(), ["rooms", form.room]], success: "Room booked.", failure: "Couldn't book the room." }
  );

  return (
    <form
      className="card card-body mb-4"
      onSubmit={(event) => {
        event.preventDefault();
        book.mutate();
      }}
    >
      <h2 className="h5">Book a study room</h2>
      <div className="row g-2">
        <div className="col-md-4">
          <FormField label="Room" as="select" className="" value={form.room} onChange={set("room")} required>
            <option value="">Choose a room…</option>
            {(rooms.data?.data ?? []).map((room) => (
              <option key={room._id} value={room._id}>
                {room.name} · {room.branch?.name} ({room.capacity} seats)
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-6 col-md-3">
          <FormField label="Day" type="date" min={today()} className="" value={form.day} onChange={set("day")} required />
        </div>
        <div className="col-6 col-md-2">
          <FormField label="From" type="time" step="900" className="" value={form.start} onChange={set("start")} required />
        </div>
        <div className="col-6 col-md-3">
          <FormField label="Hours" as="select" className="" value={form.hours} onChange={set("hours")}>
            {[1, 2, 3, 4].map((hours) => (
              <option key={hours} value={hours}>
                {hours} hour{hours > 1 ? "s" : ""}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-md-9">
          <FormField label="Purpose (optional)" className="" maxLength={300} value={form.purpose} onChange={set("purpose")} />
        </div>
        <div className="col-md-3 d-flex align-items-end">
          <button type="submit" className="btn btn-primary w-100" disabled={!form.room || book.isPending}>
            {book.isPending ? <Spinner label="Booking" /> : "Book"}
          </button>
        </div>
      </div>
      {form.room && (
        <p className="small text-muted mt-2 mb-0" aria-live="polite">
          {busy.isLoading
            ? "Checking availability…"
            : busy.data?.length
              ? `Already booked on ${formatDate(dayStart)}: ${busy.data.map((slot) => `${timeOf(slot.startAt)}–${timeOf(slot.endAt)}`).join(", ")}`
              : `Free all day on ${formatDate(dayStart)}.`}
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
    success: "Booking cancelled.",
  });
  const unregister = useApiMutation((event) => apiClient.post(`/events/${event._id}/unregister`), {
    invalidate: [accountKeys.events(), ["events"]],
    success: "You are no longer registered.",
  });

  async function confirmCancel(booking) {
    if (await confirm({ title: "Cancel this booking?", message: `${booking.room?.name}, ${formatDateTime(booking.startAt)}.`, confirmLabel: "Cancel booking" })) {
      cancelBooking.mutate(booking);
    }
  }
  async function confirmUnregister(event) {
    if (await confirm({ title: "Leave this event?", message: `“${event.title}” on ${formatDateTime(event.startAt)}.`, confirmLabel: "Unregister" })) {
      unregister.mutate(event);
    }
  }

  const upcoming = (booking) => booking.status === "confirmed" && new Date(booking.startAt) > new Date();

  return (
    <>
      <BookRoomForm />
      <h2 className="h5">My room bookings</h2>
      <DataTable
        caption="Room bookings"
        query={bookings}
        rows={bookings.data ?? []}
        empty={{ icon: "door-open", title: "No room bookings" }}
        columns={[
          { key: "room", header: "Room", render: (booking) => <>{booking.room?.name}<div className="small text-muted">{booking.branch?.name}</div></> },
          { key: "when", header: "When", render: (booking) => `${formatDateTime(booking.startAt)} – ${timeOf(booking.endAt)}` },
          { key: "status", header: "Status", hideBelow: "sm", render: (booking) => <StatusBadge status={booking.status} /> },
          {
            key: "actions",
            header: <span className="visually-hidden">Actions</span>,
            className: "text-end",
            render: (booking) =>
              upcoming(booking) && (
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => confirmCancel(booking)} aria-label={`Cancel booking of ${booking.room?.name}`}>
                  Cancel
                </button>
              ),
          },
        ]}
      />
      <h2 className="h5 mt-4">My events</h2>
      <DataTable
        caption="Event registrations"
        query={events}
        rows={events.data ?? []}
        empty={{ icon: "calendar-event", title: "You're not registered for any events", action: <Link to="/events">See upcoming events</Link> }}
        columns={[
          { key: "title", header: "Event", render: (event) => <>{event.title}<div className="small text-muted">{event.branch?.name}</div></> },
          { key: "when", header: "When", render: (event) => formatDateTime(event.startAt) },
          { key: "status", header: "Status", hideBelow: "sm", render: (event) => <StatusBadge status={event.status} /> },
          {
            key: "actions",
            header: <span className="visually-hidden">Actions</span>,
            className: "text-end",
            render: (event) =>
              event.status === "scheduled" &&
              new Date(event.startAt) > new Date() && (
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => confirmUnregister(event)} aria-label={`Unregister from ${event.title}`}>
                  Unregister
                </button>
              ),
          },
        ]}
      />
    </>
  );
}
