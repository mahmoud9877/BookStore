import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, fetchJson, useApiMutation } from "../../lib/resource.js";
import { formatDate, formatTitle } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";
import { t } from "../../i18n/index.js";

const OPEN = ["waiting", "in_transit", "ready"];

function progress(reservation) {
  if (reservation.status === "ready") return <span className="text-success fw-semibold">{t("Ready to collect until {date}", { date: formatDate(reservation.expiresAt) })}</span>;
  if (reservation.status === "in_transit") return t("A copy is on its way");
  if (reservation.status === "waiting") return t("Number {position} in the queue", { position: reservation.queuePosition });
  return <span className="text-muted">{t("Closed {date}", { date: formatDate(reservation.closedAt) })}</span>;
}

/** The member's reservations: where they are in the queue, and cancelling. */
export default function MyReservationsPage() {
  const reservations = useQuery({ queryKey: accountKeys.reservations(), queryFn: async () => (await fetchJson("/reservations/me")).data });
  const cancel = useApiMutation((reservation) => apiClient.post(`/reservations/me/${reservation._id}/cancel`, {}), {
    invalidate: [accountKeys.all],
    success: t("Reservation cancelled."),
  });

  async function handleCancel(reservation) {
    const title = formatTitle(reservation.book?.bookTitle);
    const ok = await confirm({
      title: t("Cancel this reservation?"),
      message: t("You'll lose your place in the queue for “{title}”.", { title }),
      confirmLabel: t("Cancel reservation"),
    });
    if (ok) cancel.mutate(reservation);
  }

  const columns = [
    {
      key: "title",
      header: t("Title"),
      render: (reservation) => (
        <Link to={`/book/${reservation.book?._id}`} className="fw-semibold">
          {formatTitle(reservation.book?.bookTitle)}
        </Link>
      ),
    },
    { key: "pickup", header: t("Pick up at"), hideBelow: "md", render: (reservation) => reservation.pickupBranch?.name },
    { key: "progress", header: t("Progress"), render: progress },
    { key: "status", header: t("Status"), hideBelow: "sm", render: (reservation) => <StatusBadge status={reservation.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">{t("Actions")}</span>,
      className: "text-end",
      render: (reservation) =>
        OPEN.includes(reservation.status) && (
          <button
            type="button"
            className="btn btn-sm btn-ghost-danger"
            disabled={cancel.isPending}
            aria-label={t("Cancel reservation for {title}", { title: formatTitle(reservation.book?.bookTitle) })}
            onClick={() => handleCancel(reservation)}
          >
            {t("Cancel")}
          </button>
        ),
    },
  ];

  return (
    <DataTable
      caption={t("My reservations")}
      columns={columns}
      query={reservations}
      rows={reservations.data ?? []}
      empty={{
        icon: "bookmark",
        title: t("No reservations"),
        message: t("Reserve a title from its page when every copy is out."),
        action: <Link to="/catalog">{t("Browse the catalogue")}</Link>,
      }}
    />
  );
}
