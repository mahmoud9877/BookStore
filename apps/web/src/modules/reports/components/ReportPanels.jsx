import React from "react";
import { Bar } from "./report-definitions.jsx";
import { formatMoney, formatNumber, humanize } from "../../../lib/format.js";
import { t, tp } from "../../../i18n/index.js";

function Tile({ label, value, note }) {
  return (
    <div className="col-6 col-xl-4">
      <div className="stat-tile">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {note && <div className="stat-note">{note}</div>}
      </div>
    </div>
  );
}

export function SummaryReport({ data }) {
  if (!data) return null;
  const totalCopies = Object.values(data.copies).reduce((sum, count) => sum + count, 0);
  const statuses = Object.entries(data.copies).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="row g-3 mb-3">
        <Tile label={t("Titles")} value={formatNumber(data.titles)} />
        <Tile label={t("Copies")} value={formatNumber(totalCopies)} />
        <Tile label={t("Active loans")} value={formatNumber(data.activeLoans)} note={t("{count} overdue", { count: formatNumber(data.overdueLoans) })} />
        <Tile label={t("Active members")} value={formatNumber(data.members.active)} note={t("{expired} expired · {suspended} suspended", { expired: formatNumber(data.members.expired), suspended: formatNumber(data.members.suspended) })} />
        <Tile label={t("Fines outstanding")} value={formatMoney(data.outstandingFines)} />
        <Tile label={t("Collected this month")} value={formatMoney(data.collectedThisMonth)} note={t("{count} open reservations", { count: formatNumber(data.openReservations) })} />
      </div>
      <div className="card card-body">
        <h3 className="h6">{t("Copies by status")}</h3>
        <table className="table table-sm mb-0">
          <caption className="visually-hidden">{t("Copies by status")}</caption>
          <tbody>
            {statuses.map(([status, count]) => (
              <tr key={status}>
                <th scope="row" className="fw-normal" style={{ width: "35%" }}>{humanize(status)}</th>
                <td><Bar value={count} max={totalCopies} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MembershipsReport({ data }) {
  if (!data) return null;
  return (
    <>
      <div className="row g-3 mb-3">
        <Tile label={t("Joined in period")} value={formatNumber(data.joinedInPeriod)} />
        <Tile label={t("Expiring within 30 days")} value={formatNumber(data.expiringWithin30Days)} />
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table data-table align-middle">
            <caption className="visually-hidden">{t("Members by membership type")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("Membership type")}</th>
                <th scope="col">{t("Active")}</th>
                <th scope="col">{t("Expired")}</th>
                <th scope="col">{t("Suspended")}</th>
                <th scope="col">{t("Cancelled")}</th>
              </tr>
            </thead>
            <tbody>
              {data.byType.map((row) => (
                <tr key={row.type?._id ?? "none"}>
                  <td>{row.type?.name ?? t("Unknown type")}</td>
                  <td>{row.active}</td>
                  <td>{row.expired}</td>
                  <td>{row.suspended}</td>
                  <td>{row.cancelled}</td>
                </tr>
              ))}
              {!data.byType.length && (
                <tr>
                  <td colSpan={5} className="text-muted">{t("No members match these filters.")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Extra figures some reports return next to their rows. */
export function ReportTotals({ reportKey, body }) {
  if (!body) return null;
  if (reportKey === "fines" && body.totals) {
    const { outstanding, collected, refunded, issuedByType } = body.totals;
    return (
      <div className="row g-3 mb-3">
        <Tile label={t("Outstanding")} value={formatMoney(outstanding)} />
        <Tile label={t("Collected in period")} value={formatMoney(collected)} note={t("{amount} refunded", { amount: formatMoney(refunded) })} />
        <Tile
          label={t("Issued in period")}
          value={formatMoney(issuedByType.reduce((sum, row) => sum + row.amount, 0))}
          note={issuedByType.map((row) => `${humanize(row.type)}: ${formatNumber(row.count)}`).join(" · ") || t("None")}
        />
      </div>
    );
  }
  if (reportKey === "reservations" && body.outcomes) {
    const outcomes = Object.entries(body.outcomes);
    return (
      <div className="row g-3 mb-3">
        <Tile label={t("Ended in period")} value={formatNumber(outcomes.reduce((sum, [, count]) => sum + count, 0))} note={outcomes.map(([status, count]) => `${humanize(status)}: ${formatNumber(count)}`).join(" · ") || t("None")} />
        <Tile label={t("Average wait")} value={body.averageWaitHours == null ? "—" : tp("hour", Math.round(body.averageWaitHours))} note={t("from placing to ready")} />
      </div>
    );
  }
  return null;
}
