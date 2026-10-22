import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { usePagedQuery } from "../../lib/resource.js";
import { daysUntil, formatDate, formatMoney, formatTitle } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";

function Count({ label, value, to, tone }) {
  return (
    <div className="col-6 col-md-3">
      <Link to={to} className="stat-tile d-block text-decoration-none text-body">
        <div className="stat-label">{label}</div>
        <div className={`stat-value ${tone ?? ""}`}>{value}</div>
      </Link>
    </div>
  );
}

/** Membership card, account counts and the loans due soonest. */
export default function AccountOverviewPage() {
  const { membership } = useOutletContext();
  const loans = usePagedQuery(accountKeys.loans(), "/loans/me", { status: "active", limit: 50 });
  const { summary } = membership;
  const dueSoon = [...(loans.data?.data ?? [])].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).slice(0, 5);
  const expiresIn = daysUntil(membership.expiresAt);

  return (
    <>
      <div className="card mb-4">
        <div className="card-body d-flex flex-wrap gap-4 align-items-center">
          <i className="bi bi-person-vcard display-6 text-primary" aria-hidden="true"></i>
          <div className="flex-grow-1">
            <h2 className="h5 mb-1">{membership.name}</h2>
            <div className="text-muted small">
              Card <strong className="text-body">{membership.memberNumber}</strong> · {membership.membershipType?.name} · Home branch{" "}
              {membership.homeBranch?.name}
            </div>
          </div>
          <div className="text-md-end">
            <StatusBadge status={membership.isExpired ? "expired" : membership.status} />
            <div className={`small mt-1 ${expiresIn <= 30 ? "text-warning-emphasis" : "text-muted"}`}>
              {membership.isExpired ? "Expired" : "Valid until"} {formatDate(membership.expiresAt)}
              {!membership.isExpired && expiresIn <= 30 && ` (${expiresIn} days) — renew at any branch`}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <Count label="On loan" value={`${summary.activeLoans} / ${membership.membershipType?.loanLimit ?? "—"}`} to="loans" />
        <Count label="Overdue" value={summary.overdueLoans} to="loans" tone={summary.overdueLoans ? "text-danger" : ""} />
        <Count label="Reservations" value={summary.activeReservations} to="reservations" />
        <Count label="Balance" value={formatMoney(summary.balance)} to="fines" tone={summary.balance ? "text-danger" : ""} />
      </div>

      <h2 className="h5">Due soonest</h2>
      {loans.isLoading ? (
        <p className="text-muted" aria-busy="true">
          Loading loans…
        </p>
      ) : dueSoon.length === 0 ? (
        <p className="text-muted">
          Nothing on loan. <Link to="/">Find something to read</Link>.
        </p>
      ) : (
        <ul className="list-group">
          {dueSoon.map((loan) => {
            const days = daysUntil(loan.dueAt);
            return (
              <li key={loan._id} className="list-group-item d-flex flex-wrap justify-content-between gap-2">
                <Link to={`/book/${loan.book?._id}`}>{formatTitle(loan.book?.bookTitle)}</Link>
                <span className={days < 0 ? "text-danger" : days <= 3 ? "text-warning-emphasis" : "text-muted"}>
                  {days < 0 ? `Overdue since ${formatDate(loan.dueAt)}` : `Due ${formatDate(loan.dueAt)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
