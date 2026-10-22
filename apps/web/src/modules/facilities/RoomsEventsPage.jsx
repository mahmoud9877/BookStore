import React, { useState } from "react";
import SimpleCrudSection from "../authors/SimpleCrudSection.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import FormField from "../../components/ui/FormField.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import useListState from "../../hooks/useListState.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../lib/resource.js";
import { formatDateTime, humanize } from "../../lib/format.js";
import { useActiveBranches } from "../branches/branch.queries.js";

const ROOM_KINDS = ["study", "reading", "meeting", "event"];

/** `<input type="datetime-local">` value -> ISO string (local time). */
const toIso = (local) => (local ? new Date(local).toISOString() : "");

function useRooms(branch) {
  const query = usePagedQuery(["rooms", "options", branch], "/rooms", { limit: 100, isActive: true, ...(branch && { branch }) });
  return query.data?.data ?? [];
}

function BookingForm({ onSubmit }) {
  const rooms = useRooms();
  const [values, setValues] = useState({ room: "", startAt: "", endAt: "", purpose: "", member: "" });
  const [error, setError] = useState("");
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  function submit(event) {
    event.preventDefault();
    if (!values.room || !values.startAt || !values.endAt) return setError("Choose a room, a start and an end.");
    if (new Date(values.endAt) <= new Date(values.startAt)) return setError("The booking must end after it starts.");
    setError("");
    return onSubmit({
      room: values.room,
      startAt: toIso(values.startAt),
      endAt: toIso(values.endAt),
      ...(values.purpose && { purpose: values.purpose }),
      ...(values.member.trim() && { member: values.member.trim() }),
    });
  }
  return (
    <form id="booking-form" onSubmit={submit} noValidate>
      <FormField label="Room" as="select" value={values.room} onChange={set("room")}>
        <option value="">Choose…</option>
        {rooms.map((room) => (
          <option key={room._id} value={room._id}>
            {room.name} ({room.branch?.name})
          </option>
        ))}
      </FormField>
      <div className="row g-2">
        <div className="col-sm-6">
          <FormField label="Starts" type="datetime-local" className="" value={values.startAt} onChange={set("startAt")} />
        </div>
        <div className="col-sm-6">
          <FormField label="Ends" type="datetime-local" className="" value={values.endAt} onChange={set("endAt")} />
        </div>
      </div>
      <FormField label="Purpose" className="mt-3" value={values.purpose} onChange={set("purpose")} />
      <FormField label="Member id" value={values.member} onChange={set("member")} hint="Optional: leave empty for a library booking." error={error} />
    </form>
  );
}

function BookingsSection() {
  const { filters, params, setFilter, setPage } = useListState({ status: "confirmed", from: new Date().toISOString().slice(0, 10) });
  const query = usePagedQuery(["rooms", "bookings"], "/rooms/bookings", params);
  const [creating, setCreating] = useState(false);
  const book = useApiMutation((body) => apiClient.post("/rooms/bookings", body), { invalidate: [["rooms"]], success: "Room booked." });
  const cancel = useApiMutation(({ id, reason }) => apiClient.post(`/rooms/bookings/${id}/cancel`, { reason }), { invalidate: [["rooms"]], success: "Booking cancelled." });

  async function handleCancel(booking) {
    if (await confirm({ title: "Cancel this booking?", message: `${booking.room?.name}, ${formatDateTime(booking.startAt)}.`, confirmLabel: "Cancel booking" })) {
      cancel.mutate({ id: booking._id, reason: "Cancelled by staff" });
    }
  }

  const columns = [
    { key: "room", header: "Room", render: (booking) => booking.room?.name },
    { key: "when", header: "When", render: (booking) => `${formatDateTime(booking.startAt)} – ${new Date(booking.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` },
    { key: "member", header: "Booked for", hideBelow: "md", render: (booking) => (booking.member ? `${booking.member.name} (${booking.member.memberNumber})` : booking.event ? "Event" : "Library") },
    { key: "purpose", header: "Purpose", hideBelow: "lg" },
    { key: "status", header: "Status", render: (booking) => <StatusBadge status={booking.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end",
      render: (booking) =>
        booking.status === "confirmed" && (
          <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => handleCancel(booking)} aria-label={`Cancel booking of ${booking.room?.name}`}>
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        query={query}
        onPageChange={setPage}
        caption="Room bookings"
        toolbar={
          <>
            <label className="small text-muted" htmlFor="bookings-from">
              From
            </label>
            <input id="bookings-from" type="date" className="form-control form-control-sm" style={{ maxWidth: 170 }} value={filters.from} onChange={(event) => setFilter("from", event.target.value)} />
            <select className="form-select form-select-sm" style={{ maxWidth: 160 }} aria-label="Status" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
              <option value="">Any status</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => setCreating(true)}>
              <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Book a room
            </button>
          </>
        }
        empty={{ icon: "calendar", title: "No bookings in this period" }}
      />
      {creating && (
        <Modal
          title="Book a room"
          onClose={() => !book.isPending && setCreating(false)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setCreating(false)} disabled={book.isPending}>
                Cancel
              </button>
              <button type="submit" form="booking-form" className="btn btn-primary" disabled={book.isPending}>
                {book.isPending ? <Spinner label="Booking" /> : "Book"}
              </button>
            </>
          }
        >
          <BookingForm onSubmit={(body) => book.mutateAsync(body).then(() => setCreating(false), () => {})} />
        </Modal>
      )}
    </>
  );
}

function EventForm({ onSubmit }) {
  const branches = useActiveBranches().data;
  const [values, setValues] = useState({ branch: "", room: "", title: "", description: "", startAt: "", endAt: "", capacity: 20, isPublic: true });
  const [error, setError] = useState("");
  const rooms = useRooms(values.branch);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  function submit(event) {
    event.preventDefault();
    if (!values.branch || !values.title.trim() || !values.startAt || !values.endAt) return setError("Fill in the branch, title, start and end.");
    if (new Date(values.endAt) <= new Date(values.startAt)) return setError("The event must end after it starts.");
    if (!(Number(values.capacity) >= 1)) return setError("Capacity must be at least 1.");
    setError("");
    return onSubmit({
      branch: values.branch,
      ...(values.room && { room: values.room }),
      title: values.title.trim(),
      description: values.description,
      startAt: toIso(values.startAt),
      endAt: toIso(values.endAt),
      capacity: Number(values.capacity),
      isPublic: values.isPublic,
    });
  }
  return (
    <form id="event-form" onSubmit={submit} noValidate>
      <FormField label="Title" value={values.title} onChange={set("title")} />
      <FormField label="Description" as="textarea" rows={2} value={values.description} onChange={set("description")} />
      <div className="row g-2">
        <div className="col-sm-6">
          <FormField label="Branch" as="select" className="" value={values.branch} onChange={set("branch")}>
            <option value="">Choose…</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-sm-6">
          <FormField label="Room (books it)" as="select" className="" value={values.room} onChange={set("room")} disabled={!values.branch}>
            <option value="">No room</option>
            {rooms.map((room) => (
              <option key={room._id} value={room._id}>
                {room.name}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-sm-6">
          <FormField label="Starts" type="datetime-local" className="" value={values.startAt} onChange={set("startAt")} />
        </div>
        <div className="col-sm-6">
          <FormField label="Ends" type="datetime-local" className="" value={values.endAt} onChange={set("endAt")} />
        </div>
        <div className="col-sm-6">
          <FormField label="Capacity" type="number" min="1" className="" value={values.capacity} onChange={set("capacity")} />
        </div>
      </div>
      <div className="form-check mt-3">
        <input id="event-public" type="checkbox" className="form-check-input" checked={values.isPublic} onChange={set("isPublic")} />
        <label className="form-check-label" htmlFor="event-public">
          Listed publicly
        </label>
      </div>
      {error && <div className="invalid-feedback d-block">{error}</div>}
    </form>
  );
}

function EventsSection() {
  const { params, setPage } = useListState({ upcoming: true }, { limit: 20 });
  const query = usePagedQuery(["events", "admin"], "/events", { ...params, sort: "startAt" });
  const [creating, setCreating] = useState(false);
  const create = useApiMutation((body) => apiClient.post("/events", body), { invalidate: [["events"], ["rooms"]], success: "Event created." });
  const cancel = useApiMutation((id) => apiClient.post(`/events/${id}/cancel`, { reason: "Cancelled by staff" }), { invalidate: [["events"], ["rooms"]], success: "Event cancelled." });

  async function handleCancel(event) {
    if (await confirm({ title: "Cancel this event?", message: `“${event.title}” — ${event.registered} registered member(s). Its room booking is released.`, confirmLabel: "Cancel event" })) cancel.mutate(event._id);
  }

  const columns = [
    { key: "title", header: "Event", render: (event) => <span className="fw-semibold">{event.title}</span> },
    { key: "startAt", header: "When", render: (event) => formatDateTime(event.startAt) },
    { key: "where", header: "Where", hideBelow: "md", render: (event) => `${event.branch?.name ?? ""}${event.room ? ` · ${event.room.name}` : ""}` },
    { key: "registered", header: "Registered", className: "text-end", render: (event) => `${event.registered} / ${event.capacity}` },
    { key: "status", header: "Status", render: (event) => <StatusBadge status={event.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end",
      render: (event) =>
        event.status === "scheduled" && (
          <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => handleCancel(event)} aria-label={`Cancel ${event.title}`}>
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        query={query}
        onPageChange={setPage}
        caption="Upcoming events"
        toolbar={
          <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => setCreating(true)}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>New event
          </button>
        }
        empty={{ icon: "calendar-event", title: "No upcoming events" }}
      />
      {creating && (
        <Modal
          title="New event"
          onClose={() => !create.isPending && setCreating(false)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setCreating(false)} disabled={create.isPending}>
                Cancel
              </button>
              <button type="submit" form="event-form" className="btn btn-primary" disabled={create.isPending}>
                {create.isPending ? <Spinner label="Saving" /> : "Create event"}
              </button>
            </>
          }
        >
          <EventForm onSubmit={(body) => create.mutateAsync(body).then(() => setCreating(false), () => {})} />
        </Modal>
      )}
    </>
  );
}

const TABS = [
  ["bookings", "Bookings"],
  ["events", "Events"],
  ["rooms", "Rooms"],
];

/** Staff page: bookable rooms, room bookings and events. */
export default function RoomsEventsPage() {
  const branches = useActiveBranches().data;
  const [tab, setTab] = useState("bookings");
  return (
    <>
      <PageHeader title="Rooms & events" description="Bookings never overlap; an event held in a room books that room." />
      <ul className="nav nav-tabs mb-3" role="tablist">
        {TABS.map(([id, label]) => (
          <li className="nav-item" role="presentation" key={id}>
            <button type="button" role="tab" aria-selected={tab === id} className={`nav-link ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      {tab === "bookings" && <BookingsSection />}
      {tab === "events" && <EventsSection />}
      {tab === "rooms" && (
        <SimpleCrudSection
          entity="Room"
          queryKey={["rooms", "admin"]}
          url="/rooms"
          invalidate={[["rooms"]]}
          searchPlaceholder="Search rooms"
          fields={[
            { name: "branch", label: "Branch", type: "select", required: true, onlyOnCreate: true, options: branches.map((branch) => ({ value: branch._id, label: branch.name })) },
            { name: "name", label: "Name", required: true },
            { name: "kind", label: "Kind", type: "select", required: true, options: ROOM_KINDS.map((kind) => ({ value: kind, label: humanize(kind) })) },
            { name: "capacity", label: "Capacity", type: "number", required: true },
            { name: "features", label: "Features", hint: "Comma-separated, e.g. whiteboard, projector" },
            { name: "isActive", label: "Bookable", type: "checkbox" },
          ]}
          columns={[
            { key: "name", header: "Room", render: (room) => <span className="fw-semibold">{room.name}</span> },
            { key: "branch", header: "Branch", hideBelow: "md", render: (room) => room.branch?.name },
            { key: "kind", header: "Kind", render: (room) => humanize(room.kind) },
            { key: "capacity", header: "Seats", className: "text-end" },
            { key: "isActive", header: "Status", render: (room) => <StatusBadge status={room.isActive ? "active" : "closed"} label={room.isActive ? "Bookable" : "Closed"} /> },
          ]}
          toForm={(room) => ({ branch: room.branch?._id ?? "", name: room.name ?? "", kind: room.kind ?? "study", capacity: room.capacity ?? 4, features: (room.features ?? []).join(", "), isActive: room.isActive ?? true })}
          fromForm={(values, existing) => ({
            ...(!existing._id && { branch: values.branch }),
            name: values.name,
            kind: values.kind,
            capacity: Number(values.capacity),
            features: values.features.split(",").map((feature) => feature.trim()).filter(Boolean),
            isActive: values.isActive,
          })}
        />
      )}
    </>
  );
}
