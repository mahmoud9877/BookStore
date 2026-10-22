import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { SkeletonRows } from "../../components/ui/Skeleton.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import { useDataQuery, usePagedQuery } from "../../lib/resource.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { formatDate, formatMoney, formatTitle, humanize } from "../../lib/format.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS as P } from "../auth/permissions.js";
import { useAdminSections } from "./useAdminSections.js";
import { selectUser, useAuthStore } from "../auth/auth.store.js";

// Copy statuses in the order the inventory bar shows them.
const STATUS_ORDER = ["available", "on_loan", "on_hold", "in_transit", "damaged", "missing", "lost"];

function Stat({ label, value, note, to, tone }) {
  const content = (
    <div className={`stat-tile ${tone ? `stat-${tone}` : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
  return <div className="col-6 col-xl-3">{to ? <Link to={to} className="stat-link">{content}</Link> : content}</div>;
}

function Panel({ title, action, children, busy }) {
  return (
    <section className="card h-100" aria-busy={busy ? "true" : undefined}>
      <div className="card-header panel-header">
        <h2 className="h6 mb-0">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelBody({ query, empty, children }) {
  if (query.isLoading) return <SkeletonRows rows={4} columns={3} />;
  if (query.error) {
    return (
      <div className="p-3">
        <ErrorState message={getErrorMessage(query.error, "Couldn't load this.")} onRetry={query.refetch} />
      </div>
    );
  }
  return query.isEmpty ? <p className="text-muted p-3 mb-0">{empty}</p> : children;
}

function RecentCirculation() {
  const loans = usePagedQuery(["loans", "recent"], "/loans", { sort: "-checkedOutAt", limit: 6 });
  const rows = loans.data?.data ?? [];
  return (
    <Panel title="Recent circulation" action={<Link to="loans" className="small">All loans</Link>}>
      <PanelBody query={{ ...loans, isEmpty: !rows.length }} empty="No loans yet.">
        <ul className="list-group list-group-flush">
          {rows.map((loan) => {
            const overdue = loan.status === "active" && new Date(loan.dueAt) < new Date();
            return (
              <li key={loan._id} className="list-group-item d-flex align-items-center gap-3">
                <div className="min-w-0 flex-grow-1">
                  <div className="fw-semibold text-truncate">{formatTitle(loan.book?.bookTitle ?? "")}</div>
                  <div className="small text-muted text-truncate">
                    {loan.member?.name} · {loan.copy?.barcode} · {formatDate(loan.checkedOutAt)}
                  </div>
                </div>
                <StatusBadge status={overdue ? "overdue" : loan.status} />
              </li>
            );
          })}
        </ul>
      </PanelBody>
    </Panel>
  );
}

function OverdueLoans() {
  const overdue = usePagedQuery(["reports", "overdue", "preview"], "/reports/overdue", { limit: 5 });
  const rows = overdue.data?.data ?? [];
  return (
    <Panel title="Most overdue" action={<Link to="loans" className="small">Review loans</Link>}>
      <PanelBody query={{ ...overdue, isEmpty: !rows.length }} empty="Nothing is overdue.">
        <ul className="list-group list-group-flush">
          {rows.map((row) => (
            <li key={row.loanId} className="list-group-item d-flex align-items-center gap-3">
              <div className="min-w-0 flex-grow-1">
                <div className="fw-semibold text-truncate">{formatTitle(row.title ?? "")}</div>
                <div className="small text-muted text-truncate">
                  {row.memberName} ({row.memberNumber}) · {row.branch}
                </div>
              </div>
              <span className="badge status-badge status-danger">
                <i className="bi bi-clock-history me-1" aria-hidden="true"></i>
                {row.daysOverdue} {row.daysOverdue === 1 ? "day" : "days"}
              </span>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

function InventoryBar({ copies }) {
  const total = Object.values(copies).reduce((sum, count) => sum + count, 0);
  if (!total) return <p className="text-muted p-3 mb-0">No copies yet.</p>;
  const parts = STATUS_ORDER.filter((status) => copies[status]).map((status) => ({ status, count: copies[status] }));
  return (
    <div className="p-3">
      <div className="stacked-bar" aria-hidden="true">
        {parts.map(({ status, count }) => (
          <span key={status} className={`stacked-bar-part bar-${status}`} style={{ width: `${(count / total) * 100}%` }} />
        ))}
      </div>
      <ul className="legend mt-3">
        {parts.map(({ status, count }) => (
          <li key={status}>
            <span className={`legend-swatch bar-${status}`} aria-hidden="true"></span>
            {humanize(status)} <strong>{count}</strong> <span className="text-muted">({Math.round((count / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BranchComparison() {
  const branches = useDataQuery(["reports", "branches"], "/reports/branches");
  const rows = branches.data ?? [];
  const maxLoans = Math.max(1, ...rows.map((row) => row.loans));
  return (
    <Panel title="Branches" action={<Link to="reports" className="small">Reports</Link>}>
      <PanelBody query={{ ...branches, isEmpty: !rows.length }} empty="No branches yet.">
        {/* Focusable so keyboard users can scroll it horizontally on small screens. */}
        <div className="table-responsive" tabIndex={0} role="region" aria-label="Branch comparison">
          <table className="table data-table align-middle mb-0">
            <caption className="visually-hidden">Copies, loans, overdue loans and active members per branch</caption>
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col" className="text-end">Copies</th>
                <th scope="col">Loans</th>
                <th scope="col" className="text-end">Overdue</th>
                <th scope="col" className="text-end d-none d-sm-table-cell">Members</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.branch._id}>
                  <td className="fw-semibold">{row.branch.name}</td>
                  <td className="text-end tabular">{row.copies}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="tabular">{row.loans}</span>
                      <span className="mini-bar" aria-hidden="true">
                        <span style={{ width: `${(row.loans / maxLoans) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className={`text-end tabular ${row.overdue ? "text-danger fw-semibold" : ""}`}>{row.overdue}</td>
                  <td className="text-end tabular d-none d-sm-table-cell">{row.activeMembers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelBody>
    </Panel>
  );
}

const QUICK_ACTIONS = [
  { to: "desk", label: "Check out or return", icon: "upc-scan", permissions: [P.CirculationManage] },
  { to: "members", label: "Find or register a member", icon: "person-plus", permissions: [P.MembersManage, P.MembersRead] },
  { to: "reservations", label: "Reservations", icon: "bookmark-star", permissions: [P.ReservationsManage] },
  { to: "copies", label: "Add copies", icon: "plus-square", permissions: [P.CopiesManage] },
];

/**
 * Dashboard home. Every figure comes from the API (reports and loans) and each
 * widget only renders for roles allowed to call its endpoint.
 */
export default function OverviewPage() {
  const user = useAuthStore(selectUser);
  const { can } = usePermissions();
  const canReport = can(P.ReportsRead);
  const canSeeLoans = can(P.CirculationManage, P.MembersRead);
  const summary = useDataQuery(["reports", "summary"], "/reports/summary", undefined, { enabled: canReport });
  const sections = useAdminSections();
  const actions = QUICK_ACTIONS.filter((action) => can(...action.permissions));
  const data = summary.data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.userName ?? ""}`}
        documentTitle="Dashboard"
        description={canReport ? "Today across the branches you can see." : "Your workspace."}
        actions={
          actions.length > 0 &&
          actions.slice(0, 2).map((action, index) => (
            <Link key={action.to} to={action.to} className={`btn ${index === 0 ? "btn-primary" : "btn-outline-primary"}`}>
              <i className={`bi bi-${action.icon} me-2`} aria-hidden="true"></i>
              {action.label}
            </Link>
          ))
        }
      />

      {canReport &&
        (summary.isLoading ? (
          <div className="row g-3 mb-4" aria-busy="true" aria-label="Loading figures">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="col-6 col-xl-3" key={index}>
                <div className="stat-tile">
                  <span className="skeleton skeleton-line mb-3" style={{ width: "40%" }} />
                  <span className="skeleton skeleton-line" style={{ width: "55%", height: "1.5rem" }} />
                </div>
              </div>
            ))}
          </div>
        ) : summary.error ? (
          <div className="mb-4">
            <ErrorState message={getErrorMessage(summary.error, "Couldn't load the summary.")} onRetry={summary.refetch} />
          </div>
        ) : (
          <div className="row g-3 mb-4">
            <Stat label="On loan" value={data.activeLoans} note={`${data.overdueLoans} overdue`} to="loans" tone={data.overdueLoans ? "alert" : undefined} />
            <Stat label="Available copies" value={data.copies.available ?? 0} note={`of ${Object.values(data.copies).reduce((a, b) => a + b, 0)} copies · ${data.titles} titles`} to="copies" />
            <Stat label="Active members" value={data.members.active} note={`${data.members.expired} expired · ${data.members.suspended} suspended`} to="members" />
            <Stat label="Open reservations" value={data.openReservations} to="reservations" />
            <Stat label="Fines outstanding" value={formatMoney(data.outstandingFines)} to="fines" />
            <Stat label="Collected this month" value={formatMoney(data.collectedThisMonth)} to="reports" />
            <Stat label="In transit" value={data.copies.in_transit ?? 0} note="between branches" to="transfers" />
            <Stat label="Lost or missing" value={(data.copies.lost ?? 0) + (data.copies.missing ?? 0)} to="copies" />
          </div>
        ))}

      {(canSeeLoans || canReport) && (
        <div className="row g-3 mb-4">
          {canSeeLoans && (
            <div className={canReport ? "col-lg-6" : "col-12"}>
              <RecentCirculation />
            </div>
          )}
          {canReport && (
            <div className={canSeeLoans ? "col-lg-6" : "col-12"}>
              <OverdueLoans />
            </div>
          )}
        </div>
      )}

      {canReport && data && (
        <div className="row g-3 mb-4">
          <div className="col-lg-5">
            <Panel title="Copies by status" action={<Link to="copies" className="small">Copies</Link>}>
              <InventoryBar copies={data.copies} />
            </Panel>
          </div>
          <div className="col-lg-7">
            <BranchComparison />
          </div>
        </div>
      )}

      <h2 className="h6 text-muted text-uppercase small fw-bold mb-3">Your sections</h2>
      <div className="row g-2">
        {sections.map(({ path, label, icon }) => (
          <div className="col-6 col-md-4 col-xl-3" key={path}>
            <Link to={path} className="section-link">
              <i className={`bi bi-${icon}`} aria-hidden="true"></i>
              <span>{label}</span>
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
