import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, fetchJson, useApiMutation } from "../../lib/resource.js";
import { formatDate, formatTitle } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";

const OPEN = ["waiting", "in_transit", "ready"];

function progress(reservation) {
  if (reservation.status === "ready") return <span className="text-success fw-semibold">Ready to collect until {formatDate(reservation.expiresAt)}</span>;
  if (reservation.status === "in_transit") return "A copy is on its way";
  if (reservation.status === "waiting") return `Number ${reservation.queuePosition} in the queue`;
  return <span className="text-muted">Closed {formatDate(reservation.closedAt)}</span>;
}

/** The member's reservations: where they are in the queue, and cancelling. */
export default function MyReservationsPage() {
  const reservations = useQuery({ queryKey: accountKeys.reservations(), queryFn: async () => (await fetchJson("/reservations/me")).data });
  const cancel = useApiMutation((reservation) => apiClient.post(`/reservations/me/${reservation._id}/cancel`, {}), {
    invalidate: [accountKeys.all],
    success: "Reservation cancelled.",
  });

  async function handleCancel(reservation) {
    const title = formatTitle(reservation.book?.bookTitle);
    const ok = await confirm({
      title: "Cancel this reservation?",
      message: `You'll lose your place in the queue for “${title}”.`,
      confirmLabel: "Cancel reservation",
    });
    if (ok) cancel.mutate(reservation);
  }

  const columns = [
    {
      key: "title",
      header: "Title",
      render: (reservation) => (
        <Link to={`/book/${reservation.book?._id}`} className="fw-semibold">
          {formatTitle(reservation.book?.bookTitle)}
        </Link>
      ),
    },
    { key: "pickup", header: "Pick up at", hideBelow: "md", render: (reservation) => reservation.pickupBranch?.name },
    { key: "progress", header: "Progress", render: progress },
    { key: "status", header: "Status", hideBelow: "sm", render: (reservation) => <StatusBadge status={reservation.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end",
      render: (reservation) =>
        OPEN.includes(reservation.status) && (
          <button
            type="button"
            className="btn btn-sm btn-ghost-danger"
            disabled={cancel.isPending}
            aria-label={`Cancel reservation for ${formatTitle(reservation.book?.bookTitle)}`}
            onClick={() => handleCancel(reservation)}
          >
            Cancel
          </button>
        ),
    },
  ];

  return (
    <DataTable
      caption="My reservations"
      columns={columns}
      query={reservations}
      rows={reservations.data ?? []}
      empty={{ icon: "bookmark", title: "No reservations", message: "Reserve a title from its page when every copy is out.", action: <Link to="/catalog">Browse the catalogue</Link> }}
    />
  );
}
