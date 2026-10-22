import React from "react";
import { Bar } from "./report-definitions.jsx";
import { formatMoney, humanize } from "../../lib/format.js";

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
        <Tile label="Titles" value={data.titles} />
        <Tile label="Copies" value={totalCopies} />
        <Tile label="Active loans" value={data.activeLoans} note={`${data.overdueLoans} overdue`} />
        <Tile label="Active members" value={data.members.active} note={`${data.members.expired} expired · ${data.members.suspended} suspended`} />
        <Tile label="Fines outstanding" value={formatMoney(data.outstandingFines)} />
        <Tile label="Collected this month" value={formatMoney(data.collectedThisMonth)} note={`${data.openReservations} open reservations`} />
      </div>
      <div className="card card-body">
        <h3 className="h6">Copies by status</h3>
        <table className="table table-sm mb-0">
          <caption className="visually-hidden">Copies by status</caption>
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
        <Tile label="Joined in period" value={data.joinedInPeriod} />
        <Tile label="Expiring within 30 days" value={data.expiringWithin30Days} />
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table data-table align-middle">
            <caption className="visually-hidden">Members by membership type</caption>
            <thead>
              <tr>
                <th scope="col">Membership type</th>
                <th scope="col">Active</th>
                <th scope="col">Expired</th>
                <th scope="col">Suspended</th>
                <th scope="col">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {data.byType.map((row) => (
                <tr key={row.type?._id ?? "none"}>
                  <td>{row.type?.name ?? "Unknown type"}</td>
                  <td>{row.active}</td>
                  <td>{row.expired}</td>
                  <td>{row.suspended}</td>
                  <td>{row.cancelled}</td>
                </tr>
              ))}
              {!data.byType.length && (
                <tr>
                  <td colSpan={5} className="text-muted">No members match these filters.</td>
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
        <Tile label="Outstanding" value={formatMoney(outstanding)} />
        <Tile label="Collected in period" value={formatMoney(collected)} note={`${formatMoney(refunded)} refunded`} />
        <Tile
          label="Issued in period"
          value={formatMoney(issuedByType.reduce((sum, row) => sum + row.amount, 0))}
          note={issuedByType.map((row) => `${humanize(row.type)}: ${row.count}`).join(" · ") || "None"}
        />
      </div>
    );
  }
  if (reportKey === "reservations" && body.outcomes) {
    const outcomes = Object.entries(body.outcomes);
    return (
      <div className="row g-3 mb-3">
        <Tile label="Ended in period" value={outcomes.reduce((sum, [, count]) => sum + count, 0)} note={outcomes.map(([status, count]) => `${humanize(status)}: ${count}`).join(" · ") || "None"} />
        <Tile label="Average wait" value={body.averageWaitHours == null ? "—" : `${Math.round(body.averageWaitHours)} h`} note="from placing to ready" />
      </div>
    );
  }
  return null;
}
