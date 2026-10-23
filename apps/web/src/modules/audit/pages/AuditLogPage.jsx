import React, { useMemo, useState } from "react";
import PageHeader from "../../../components/ui/PageHeader.jsx";
import DataTable from "../../../components/ui/DataTable.jsx";
import useListState from "../../../hooks/useListState.js";
import { usePagedQuery } from "../../../lib/resource.js";
import { formatDateTime } from "../../../lib/format.js";
import { msg, t, useLanguage } from "../../../i18n/index.js";

function Changes({ entry }) {
  const [open, setOpen] = useState(false);
  if (!entry.before && !entry.after) return <span className="text-muted small">—</span>;
  return (
    <div>
      <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <i className={`bi bi-chevron-${open ? "up" : "down"} me-1`} aria-hidden="true"></i>
        {open ? t("Hide changes") : t("Show changes")}
      </button>
      {open && (
        <div className="row g-2 mt-1">
          {["before", "after"].map((side) =>
            entry[side] ? (
              <div className="col-md-6" key={side}>
                <div className="small fw-semibold">{side === "before" ? t("Before") : t("After")}</div>
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

// API record types, with their display names.
const ENTITY_LABELS = {
  Loan: msg("Loan"),
  Reservation: msg("Reservation"),
  Copy: msg("Copy"),
  Member: msg("Member"),
  Fine: msg("Fine"),
  Payment: msg("Payment"),
  Transfer: msg("Transfer"),
  PurchaseOrder: msg("Purchase order"),
  Stocktake: msg("Stocktake"),
  Role: msg("Role"),
  User: msg("User"),
  Setting: msg("Setting"),
  Book: msg("Book"),
  Branch: msg("Branch"),
  RoomBooking: msg("Room booking"),
  Event: msg("Event"),
  DigitalPublication: msg("Digital publication"),
};
const entityLabel = (entity) => (ENTITY_LABELS[entity] ? t(ENTITY_LABELS[entity]) : entity);

// Headers are English keys, translated in AuditLogPage for the current language.
const COLUMNS = [
  { key: "createdAt", header: msg("When"), render: (entry) => <span className="text-nowrap small">{formatDateTime(entry.createdAt)}</span> },
  { key: "actorName", header: msg("Who"), render: (entry) => entry.actorName ?? t("system") },
  {
    key: "action",
    header: msg("Action"),
    render: (entry) => (
      <>
        <code>{entry.action}</code>
        <div className="small text-muted">
          {entityLabel(entry.entity)}
          {entry.entityId && <> · {entry.entityId}</>}
        </div>
        {entry.reason && <div className="small">{t("Reason: {reason}", { reason: entry.reason })}</div>}
      </>
    ),
  },
  { key: "changes", header: msg("Changes"), render: (entry) => <Changes entry={entry} /> },
];

const ENTITIES = Object.keys(ENTITY_LABELS);

/** Who did what, and when: sensitive actions with before/after values. */
export default function AuditLogPage() {
  const { language } = useLanguage();
  // t() reads the current language, so the headers are rebuilt only when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- language is read inside t()
  const columns = useMemo(() => COLUMNS.map((column) => ({ ...column, header: t(column.header) })), [language]);
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
      <PageHeader title={t("Audit log")} description={t("Sensitive actions are recorded with who did them and what changed. Passwords and tokens are never logged.")} />
      <DataTable
        caption={t("Audit log")}
        columns={columns}
        query={query}
        onPageChange={setPage}
        empty={{ icon: "journal-text", title: t("No entries match these filters") }}
        toolbar={
          <>
            {field("action", t("Action"), { placeholder: t("e.g. {example}", { example: "loan.checkout" }) })}
            <div>
              <label htmlFor="audit-entity" className="form-label small mb-1">{t("Record type")}</label>
              <select id="audit-entity" className="form-select form-select-sm" value={filters.entity} onChange={(event) => setFilter("entity", event.target.value)}>
                <option value="">{t("Any")}</option>
                {ENTITIES.map((entity) => <option key={entity} value={entity}>{entityLabel(entity)}</option>)}
              </select>
            </div>
            {field("entityId", t("Record id"), { placeholder: t("24-character id") })}
            {field("from", t("From"), { type: "date" })}
            {field("to", t("To"), { type: "date" })}
          </>
        }
      />
    </>
  );
}
