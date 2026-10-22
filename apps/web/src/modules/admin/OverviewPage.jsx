import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import { useDataQuery } from "../../lib/resource.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { formatMoney } from "../../lib/format.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { useAdminSections } from "./useAdminSections.js";
import { selectUser, useAuthStore } from "../auth/auth.store.js";

function Stat({ label, value, note, to }) {
  const content = (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
  return <div className="col-6 col-xl-3">{to ? <Link to={to} className="text-decoration-none text-body d-block h-100">{content}</Link> : content}</div>;
}

/** Dashboard home: headline figures (with reports:read) and shortcuts to the user's sections. */
export default function OverviewPage() {
  const user = useAuthStore(selectUser);
  const { can } = usePermissions();
  const canReport = can(PERMISSIONS.ReportsRead);
  const summary = useDataQuery(["reports", "summary"], "/reports/summary", undefined, { enabled: canReport });
  const sections = useAdminSections();
  const data = summary.data;

  return (
    <>
      <PageHeader title={`Welcome, ${user?.userName ?? ""}`} documentTitle="Dashboard" description="What needs attention across your branches." />
      {canReport &&
        (summary.isLoading ? (
          <p className="text-muted" aria-busy="true">
            Loading figures…
          </p>
        ) : summary.error ? (
          <ErrorState message={getErrorMessage(summary.error, "Couldn't load the summary.")} onRetry={summary.refetch} />
        ) : (
          <div className="row g-3 mb-4">
            <Stat label="On loan" value={data.activeLoans} note={`${data.overdueLoans} overdue`} to="loans" />
            <Stat label="Available copies" value={data.copies.available ?? 0} note={`${Object.values(data.copies).reduce((a, b) => a + b, 0)} copies · ${data.titles} titles`} to="copies" />
            <Stat label="Active members" value={data.members.active} note={`${data.members.expired} expired · ${data.members.suspended} suspended`} to="members" />
            <Stat label="Open reservations" value={data.openReservations} to="reservations" />
            <Stat label="Fines outstanding" value={formatMoney(data.outstandingFines)} to="fines" />
            <Stat label="Collected this month" value={formatMoney(data.collectedThisMonth)} to="reports" />
            <Stat label="In transit" value={data.copies.in_transit ?? 0} note="between branches" to="transfers" />
            <Stat label="Lost or missing" value={(data.copies.lost ?? 0) + (data.copies.missing ?? 0)} to="copies" />
          </div>
        ))}
      <h2 className="h5">Your sections</h2>
      <div className="row g-3">
        {sections.map(({ path, label, icon }) => (
          <div className="col-6 col-md-4 col-xl-3" key={path}>
            <Link to={path} className="card card-body h-100 text-decoration-none text-body d-flex flex-row align-items-center gap-3">
              <i className={`bi bi-${icon} fs-4 text-primary`} aria-hidden="true"></i>
              <span className="fw-semibold">{label}</span>
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
