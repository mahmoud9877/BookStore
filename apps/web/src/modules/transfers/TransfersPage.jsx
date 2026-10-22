import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import FormField from "../../components/ui/FormField.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import useListState from "../../hooks/useListState.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../lib/resource.js";
import { formatDateTime, formatTitle, humanize } from "../../lib/format.js";
import { useActiveBranches } from "../branches/branch.queries.js";

const STATUSES = ["requested", "in_transit", "received", "cancelled"];
const INVALIDATE = [["transfers"], ["copies"], ["reservations"], ["reports"]];

function CreateTransferForm({ branches, onSubmit }) {
  const [values, setValues] = useState({ barcode: "", toBranch: "", note: "", ship: true });
  const [errors, setErrors] = useState({});
  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!values.barcode.trim()) next.barcode = "Scan or type the copy's barcode.";
    if (!values.toBranch) next.toBranch = "Choose the destination.";
    setErrors(next);
    if (!Object.keys(next).length) onSubmit({ ...values, barcode: values.barcode.trim().toUpperCase() });
  }
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  return (
    <form id="transfer-form" onSubmit={submit} noValidate>
      <FormField label="Copy barcode" value={values.barcode} onChange={set("barcode")} error={errors.barcode} autoComplete="off" />
      <FormField label="Destination branch" as="select" value={values.toBranch} onChange={set("toBranch")} error={errors.toBranch}>
        <option value="">Choose…</option>
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id}>
            {branch.name}
          </option>
        ))}
      </FormField>
      <FormField label="Note" value={values.note} onChange={set("note")} />
      <div className="form-check">
        <input id="transfer-ship" type="checkbox" className="form-check-input" checked={values.ship} onChange={(event) => setValues((current) => ({ ...current, ship: event.target.checked }))} />
        <label htmlFor="transfer-ship" className="form-check-label">
          Ship now (the copy leaves this branch today)
        </label>
        <div className="form-text">Leave unticked to request the copy from its branch instead.</div>
      </div>
    </form>
  );
}

/** The statuses a transfer went through, oldest first. */
export function TransferHistory({ history = [] }) {
  return (
    <ol className="list-unstyled mb-0 small">
      {history.map((entry, index) => (
        <li key={`${entry.status}-${index}`} className="d-flex gap-2 align-items-baseline mb-1">
          <StatusBadge status={entry.status} />
          <span className="text-muted">{formatDateTime(entry.at)}</span>
          {entry.note && <span>— {entry.note}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Staff page: copies moving between branches (requested → in transit → received). */
export default function TransfersPage() {
  const branches = useActiveBranches().data;
  const { filters, params, setFilter, setPage } = useListState({ status: "in_transit", fromBranch: "", toBranch: "" });
  const query = usePagedQuery(["transfers"], "/transfers", params);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);

  const create = useApiMutation((body) => apiClient.post("/transfers", body), { invalidate: INVALIDATE, success: (transfer) => (transfer.status === "in_transit" ? "Transfer shipped." : "Transfer requested.") });
  const act = useApiMutation(({ id, action, note }) => apiClient.post(`/transfers/${id}/${action}`, { note }), {
    invalidate: INVALIDATE,
    success: (_result, { action }) => ({ ship: "Transfer shipped.", receive: "Transfer received.", cancel: "Transfer cancelled." })[action],
  });

  async function run(transfer, action) {
    if (action === "cancel") {
      const ok = await confirm({ title: "Cancel this transfer?", message: `${transfer.copy?.barcode} stays at (or returns to) ${transfer.fromBranch?.name}.`, confirmLabel: "Cancel transfer" });
      if (!ok) return;
    }
    act.mutate({ id: transfer._id, action });
  }

  const columns = [
    { key: "copy", header: "Copy", render: (transfer) => <span className="scan-input fw-semibold">{transfer.copy?.barcode}</span> },
    { key: "book", header: "Book", hideBelow: "md", render: (transfer) => <span className="text-capitalize">{formatTitle(transfer.book?.bookTitle ?? "")}</span> },
    { key: "route", header: "From → to", render: (transfer) => `${transfer.fromBranch?.code} → ${transfer.toBranch?.code}` },
    { key: "reason", header: "Reason", hideBelow: "lg", render: (transfer) => humanize(transfer.reason) },
    { key: "status", header: "Status", render: (transfer) => <StatusBadge status={transfer.status} /> },
    { key: "updatedAt", header: "Updated", hideBelow: "lg", render: (transfer) => formatDateTime(transfer.updatedAt) },
    {
      key: "actions",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end text-nowrap",
      render: (transfer) => (
        <>
          {transfer.status === "requested" && (
            <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => run(transfer, "ship")} disabled={act.isPending}>
              Ship
            </button>
          )}
          {transfer.status === "in_transit" && (
            <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => run(transfer, "receive")} disabled={act.isPending} aria-label={`Receive ${transfer.copy?.barcode}`}>
              Receive
            </button>
          )}
          {["requested", "in_transit"].includes(transfer.status) && (
            <button type="button" className="btn btn-sm btn-ghost-danger me-1" onClick={() => run(transfer, "cancel")} disabled={act.isPending} aria-label={`Cancel transfer of ${transfer.copy?.barcode}`}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          )}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setViewing(transfer)} aria-label={`History of ${transfer.copy?.barcode}`}>
            <i className="bi bi-clock-history" aria-hidden="true"></i>
          </button>
        </>
      ),
    },
  ];

  const branchSelect = (name, label) => (
    <select className="form-select form-select-sm" style={{ maxWidth: 190 }} aria-label={label} value={filters[name]} onChange={(event) => setFilter(name, event.target.value)}>
      <option value="">{label}: any</option>
      {branches.map((branch) => (
        <option key={branch._id} value={branch._id}>
          {branch.name}
        </option>
      ))}
    </select>
  );

  const toolbar = (
    <>
      <select className="form-select form-select-sm" style={{ maxWidth: 170 }} aria-label="Status" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
        <option value="">Any status</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {humanize(status)}
          </option>
        ))}
      </select>
      {branchSelect("fromBranch", "From")}
      {branchSelect("toBranch", "To")}
    </>
  );

  return (
    <>
      <PageHeader
        title="Transfers"
        description="Copies on their way between branches. Receiving one holds it for its reservation or shelves it."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <i className="bi bi-truck me-1" aria-hidden="true"></i>New transfer
          </button>
        }
      />
      <DataTable columns={columns} query={query} toolbar={toolbar} onPageChange={setPage} caption="Transfers" empty={{ icon: "truck", title: "No transfers match", message: "Change the filters, or start a transfer." }} />
      {creating && (
        <Modal
          title="New transfer"
          onClose={() => !create.isPending && setCreating(false)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setCreating(false)} disabled={create.isPending}>
                Cancel
              </button>
              <button type="submit" form="transfer-form" className="btn btn-primary" disabled={create.isPending}>
                {create.isPending ? <Spinner label="Saving" /> : "Create transfer"}
              </button>
            </>
          }
        >
          <CreateTransferForm branches={branches} onSubmit={(body) => create.mutateAsync(body).then(() => setCreating(false), () => {})} />
        </Modal>
      )}
      {viewing && (
        <Modal title={`Transfer of ${viewing.copy?.barcode}`} size="sm" onClose={() => setViewing(null)}>
          <p className="small mb-2">
            {viewing.fromBranch?.name} → {viewing.toBranch?.name} · {humanize(viewing.reason)}
          </p>
          <TransferHistory history={viewing.history} />
        </Modal>
      )}
    </>
  );
}
