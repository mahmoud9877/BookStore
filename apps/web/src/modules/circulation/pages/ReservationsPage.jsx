import React, { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader.jsx";
import DataTable from "../../../components/ui/DataTable.jsx";
import StatusBadge from "../../../components/ui/StatusBadge.jsx";
import useListState from "../../../hooks/useListState.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../../lib/resource.js";
import { formatDate, formatTitle, humanize } from "../../../lib/format.js";
import { usePermissions } from "../../auth/queries/auth.queries.js";
import { PERMISSIONS } from "../../auth/constants/permissions.js";
import { CIRCULATION_KEYS } from "../constants/circulation-keys.js";
import BranchSelect from "../components/BranchSelect.jsx";
import ReasonModal from "../components/ReasonModal.jsx";
import PlaceReservationModal from "../components/PlaceReservationModal.jsx";
import { t } from "../../../i18n/index.js";

const OPEN = ["waiting", "in_transit", "ready"];

/** Reservation queues of the user's pickup branches. */
export default function ReservationsPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.ReservationsManage);
  const { filters, params, setFilter, setPage } = useListState({ status: "", pickupBranch: "" });
  const query = usePagedQuery(["reservations", "list"], "/reservations", params);
  const [placing, setPlacing] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const cancel = useApiMutation(({ id, reason }) => apiClient.post(`/reservations/${id}/cancel`, { reason }), {
    invalidate: CIRCULATION_KEYS,
    success: t("Reservation cancelled."),
  });

  const columns = [
    {
      key: "book",
      header: t("Title"),
      render: (row) => (
        <>
          <div className="fw-semibold">{formatTitle(row.book?.bookTitle)}</div>
          {row.copy && <div className="small text-muted">{t("Copy {barcode}", { barcode: row.copy.barcode })}</div>}
        </>
      ),
    },
    {
      key: "member",
      header: t("Member"),
      render: (row) =>
        row.member ? (
          <Link to={`/dashboard/members/${row.member._id}`}>{row.member.name}</Link>
        ) : (
          "—"
        ),
    },
    { key: "pickupBranch", header: t("Pickup"), render: (row) => row.pickupBranch?.name, hideBelow: "md" },
    { key: "createdAt", header: t("Placed"), render: (row) => formatDate(row.createdAt), hideBelow: "lg" },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <>
          <StatusBadge status={row.status} />
          {row.status === "ready" && <div className="small text-muted">{t("until {date}", { date: formatDate(row.expiresAt) })}</div>}
        </>
      ),
    },
    {
      key: "actions",
      header: <span className="visually-hidden">{t("Actions")}</span>,
      className: "text-end",
      render: (row) =>
        canManage && OPEN.includes(row.status) ? (
          <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => setCancelling(row)} aria-label={t("Cancel reservation of {title} for {name}", { title: formatTitle(row.book?.bookTitle), name: row.member?.name })}>
            <i className="bi bi-x-circle" aria-hidden="true"></i>
          </button>
        ) : null,
    },
  ];

  const toolbar = (
    <>
      <div>
        <label htmlFor="reservation-status" className="form-label small mb-1">
          {t("Status")}
        </label>
        <select id="reservation-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">{t("All")}</option>
          {["waiting", "in_transit", "ready", "fulfilled", "cancelled", "expired"].map((status) => (
            <option key={status} value={status}>
              {humanize(status)}
            </option>
          ))}
        </select>
      </div>
      <BranchSelect id="reservation-pickup" label={t("Pickup branch")} value={filters.pickupBranch} onChange={(value) => setFilter("pickupBranch", value)} />
    </>
  );

  return (
    <>
      <PageHeader
        title={t("Reservations")}
        description={t("Holds waiting, travelling to their pickup branch, or ready to collect.")}
        actions={
          canManage && (
            <button type="button" className="btn btn-primary" onClick={() => setPlacing(true)}>
              <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
              {t("Place reservation")}
            </button>
          )
        }
      />
      <DataTable columns={columns} query={query} onPageChange={setPage} toolbar={toolbar} caption={t("Reservations")} empty={{ icon: "bookmark-star", title: t("No reservations match") }} />
      {placing && <PlaceReservationModal onClose={() => setPlacing(false)} />}
      {cancelling && (
        <ReasonModal
          title={t("Cancel this reservation?")}
          confirmLabel={t("Cancel reservation")}
          required={false}
          onClose={() => setCancelling(null)}
          onSubmit={({ reason }) => cancel.mutateAsync({ id: cancelling._id, reason })}
        />
      )}
    </>
  );
}
