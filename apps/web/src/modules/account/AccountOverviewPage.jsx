import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { usePagedQuery } from "../../lib/resource.js";
import { daysUntil, formatDate, formatMoney, formatTitle } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";
import { t, tp } from "../../i18n/index.js";

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

/** Account counts, membership warnings and the loans due soonest. */
export default function AccountOverviewPage() {
  const { membership } = useOutletContext();
  const loans = usePagedQuery(accountKeys.loans(), "/loans/me", { status: "active", limit: 50 });
  const { summary } = membership;
  const dueSoon = [...(loans.data?.data ?? [])].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).slice(0, 5);
  const expiresIn = daysUntil(membership.expiresAt);

  return (
    <>
      {/* The card details are in the portal header; here only what needs action. */}
      {(membership.isExpired || expiresIn <= 30) && (
        <div className="alert alert-warning d-flex gap-2 align-items-start" role="status">
          <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
          <span>
            {membership.isExpired
              ? t("Your membership expired on {date}. Renew it at any branch to borrow again.", { date: formatDate(membership.expiresAt) })
              : t("Your membership expires on {date} (in {days}). Renew it at any branch.", { date: formatDate(membership.expiresAt), days: tp("day", expiresIn) })}
          </span>
        </div>
      )}
      {membership.status === "suspended" && (
        <div className="alert alert-danger" role="status">
          {membership.statusReason
            ? t("Your membership is suspended: {reason}. Please contact a branch.", { reason: membership.statusReason })
            : t("Your membership is suspended. Please contact a branch.")}
        </div>
      )}

      <div className="row g-3 mb-4">
        <Count label={t("On loan")} value={`${summary.activeLoans} / ${membership.membershipType?.loanLimit ?? "—"}`} to="loans" />
        <Count label={t("Overdue")} value={summary.overdueLoans} to="loans" tone={summary.overdueLoans ? "text-danger" : ""} />
        <Count label={t("Reservations")} value={summary.activeReservations} to="reservations" />
        <Count label={t("Balance")} value={formatMoney(summary.balance)} to="fines" tone={summary.balance ? "text-danger" : ""} />
      </div>

      <h2 className="h5">{t("Due soonest")}</h2>
      {loans.isLoading ? (
        <p className="text-muted" aria-busy="true">
          {t("Loading loans…")}
        </p>
      ) : dueSoon.length === 0 ? (
        <p className="text-muted">
          {t("Nothing on loan.")} <Link to="/catalog">{t("Find something to read")}</Link>.
        </p>
      ) : (
        <ul className="list-group">
          {dueSoon.map((loan) => {
            const days = daysUntil(loan.dueAt);
            return (
              <li key={loan._id} className="list-group-item d-flex flex-wrap justify-content-between gap-2">
                <Link to={`/book/${loan.book?._id}`}>{formatTitle(loan.book?.bookTitle)}</Link>
                <span className={days < 0 ? "text-danger" : days <= 3 ? "text-warning-emphasis" : "text-muted"}>
                  {days < 0 ? t("Overdue since {date}", { date: formatDate(loan.dueAt) }) : t("Due {date}", { date: formatDate(loan.dueAt) })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
