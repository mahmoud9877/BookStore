import React from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../../../components/ui/StatusBadge.jsx";
import { formatDate, formatMoney } from "../../../lib/format.js";
import { t } from "../../../i18n/index.js";

/** A member's standing at a glance (for the desk and the member page). */
export default function MemberSummary({ member, linkToDetail = true }) {
  const summary = member.summary ?? {};
  const status = member.status === "active" && member.isExpired ? "expired" : member.status;
  return (
    <div className="card card-body" aria-label={t("Member {name}", { name: member.name })}>
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
        <div>
          <div className="fw-semibold fs-5">
            {linkToDetail ? <Link to={`/dashboard/members/${member._id}`}>{member.name}</Link> : member.name}
          </div>
          <div className="small text-muted">
            <span className="ltr">{member.memberNumber}</span> · {member.membershipType?.name} · {member.homeBranch?.name}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      {member.statusReason && <p className="small text-warning-emphasis mb-0 mt-2">{member.statusReason}</p>}
      <dl className="row small mb-0 mt-3">
        <dt className="col-6 text-muted fw-normal">{t("On loan")}</dt>
        <dd className="col-6 mb-1">
          {summary.activeLoans ?? 0} / {member.membershipType?.loanLimit ?? "—"}
        </dd>
        <dt className="col-6 text-muted fw-normal">{t("Overdue")}</dt>
        <dd className={`col-6 mb-1 ${summary.overdueLoans ? "text-danger fw-semibold" : ""}`}>{summary.overdueLoans ?? 0}</dd>
        <dt className="col-6 text-muted fw-normal">{t("Reservations")}</dt>
        <dd className="col-6 mb-1">{summary.activeReservations ?? 0}</dd>
        <dt className="col-6 text-muted fw-normal">{t("Balance")}</dt>
        <dd className={`col-6 mb-1 ${summary.balance ? "text-danger fw-semibold" : ""}`}>{formatMoney(summary.balance ?? 0)}</dd>
        <dt className="col-6 text-muted fw-normal">{t("Expires")}</dt>
        <dd className="col-6 mb-0">{formatDate(member.expiresAt)}</dd>
      </dl>
    </div>
  );
}
