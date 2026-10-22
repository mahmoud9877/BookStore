import React, { useState } from "react";
import PageHeader from "../../components/ui/PageHeader.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import useListState from "../../hooks/useListState.js";
import { usePagedQuery } from "../../lib/resource.js";
import { formatDateTime } from "../../lib/format.js";

function Changes({ entry }) {
  const [open, setOpen] = useState(false);
  if (!entry.before && !entry.after) return <span className="text-muted small">—</span>;
  return (
    <div>
      <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <i className={`bi bi-chevron-${open ? "up" : "down"} me-1`} aria-hidden="true"></i>
        {open ? "Hide changes" : "Show changes"}
      </button>
      {open && (
        <div className="row g-2 mt-1">
          {["before", "after"].map((side) =>
            entry[side] ? (
              <div className="col-md-6" key={side}>
                <div className="small fw-semibold text-capitalize">{side}</div>
                <pre className="small bg-light border rounded p-2 mb-0" style={{ maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(entry[side], null, 2)}
                </pre>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

const COLUMNS = [
  { key: "createdAt", header: "When", render: (entry) => <span className="text-nowrap small">{formatDateTime(entry.createdAt)}</span> },
  { key: "actorName", header: "Who", render: (entry) => entry.actorName ?? "system" },
  {
    key: "action",
    header: "Action",
    render: (entry) => (
      <>
        <code>{entry.action}</code>
        <div className="small text-muted">
          {entry.entity}
          {entry.entityId && <> · {entry.entityId}</>}
        </div>
        {entry.reason && <div className="small">Reason: {entry.reason}</div>}
      </>
    ),
  },
  { key: "changes", header: "Changes", render: (entry) => <Changes entry={entry} /> },
];

const ENTITIES = ["Loan", "Reservation", "Copy", "Member", "Fine", "Payment", "Transfer", "PurchaseOrder", "Stocktake", "Role", "User", "Setting", "Book", "Branch", "RoomBooking", "Event", "DigitalPublication"];

/** Who did what, and when: sensitive actions with before/after values. */
export default function AuditLogPage() {
  const { filters, params, setFilter, setPage } = useListState({ action: "", entity: "", entityId: "", from: "", to: "" }, { limit: 25 });
  // A "to" date includes that whole day.
  const query = usePagedQuery(["audit-logs"], "/audit-logs", { ...params, to: params.to ? `${params.to}T23:59:59.999Z` : "" });

  const field = (name, label, props = {}) => (
    <div>
      <label htmlFor={`audit-${name}`} className="form-label small mb-1">{label}</label>
      <input id={`audit-${name}`} className="form-control form-control-sm" value={filters[name]} onChange={(event) => setFilter(name, event.target.value)} {...props} />
    </div>
  );

  return (
    <>
      <PageHeader title="Audit log" description="Sensitive actions are recorded with who did them and what changed. Passwords and tokens are never logged." />
      <DataTable
        caption="Audit log"
        columns={COLUMNS}
        query={query}
        onPageChange={setPage}
        empty={{ icon: "journal-text", title: "No entries match these filters" }}
        toolbar={
          <>
            {field("action", "Action", { placeholder: "e.g. loan.checkout" })}
            <div>
              <label htmlFor="audit-entity" className="form-label small mb-1">Record type</label>
              <select id="audit-entity" className="form-select form-select-sm" value={filters.entity} onChange={(event) => setFilter("entity", event.target.value)}>
                <option value="">Any</option>
                {ENTITIES.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
              </select>
            </div>
            {field("entityId", "Record id", { placeholder: "24-character id" })}
            {field("from", "From", { type: "date" })}
            {field("to", "To", { type: "date" })}
          </>
        }
      />
    </>
  );
}
