import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import FormField from "../../components/ui/FormField.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import useListState from "../../hooks/useListState.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { apiClient, useApiMutation, useDataQuery, usePagedQuery } from "../../lib/resource.js";
import { formatDateTime } from "../../lib/format.js";
import { useActiveBranches, useLocations } from "../branches/branch.queries.js";

const INVALIDATE = [["stocktakes"], ["copies"], ["reports"]];

function StartForm({ onSubmit }) {
  const branches = useActiveBranches().data;
  const [branch, setBranch] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const locations = useLocations(branch).data;
  function submit(event) {
    event.preventDefault();
    if (!branch) return setError("Choose a branch.");
    return onSubmit({ branch, ...(location && { location }), notes });
  }
  return (
    <form id="stocktake-form" onSubmit={submit} noValidate>
      <FormField label="Branch" as="select" value={branch} onChange={(event) => { setBranch(event.target.value); setLocation(""); }} error={error}>
        <option value="">Choose…</option>
        {branches.map((item) => (
          <option key={item._id} value={item._id}>
            {item.name}
          </option>
        ))}
      </FormField>
      <FormField label="Only this room or shelf" as="select" value={location} onChange={(event) => setLocation(event.target.value)} disabled={!branch} hint="Leave empty to count the whole branch.">
        <option value="">Whole branch</option>
        {locations.map((item) => (
          <option key={item._id} value={item._id}>
            {item.code} {item.name}
          </option>
        ))}
      </FormField>
      <FormField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
    </form>
  );
}

function BarcodeList({ title, barcodes, tone }) {
  return (
    <div className="col-md-4">
      <h3 className="h6">
        {title} <span className={`badge status-badge status-${tone}`}>{barcodes.length}</span>
      </h3>
      {barcodes.length ? (
        <ul className="list-unstyled small scan-input mb-0" style={{ maxHeight: 220, overflowY: "auto" }}>
          {barcodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      ) : (
        <p className="small text-muted mb-0">None</p>
      )}
    </div>
  );
}

/** Scanning view: barcodes in, comparison with the records out. */
function StocktakeSession({ id, onBack }) {
  const query = useDataQuery(["stocktakes", id], `/stocktakes/${id}`);
  const [input, setInput] = useState("");
  const [apply, setApply] = useState(true);
  const scan = useApiMutation((barcodes) => apiClient.post(`/stocktakes/${id}/scans`, { barcodes }), {
    invalidate: [["stocktakes", id]],
    success: (_result, barcodes) => `Recorded ${barcodes.length} scan(s).`,
  });
  const close = useApiMutation(() => apiClient.post(`/stocktakes/${id}/close`, { apply }), { invalidate: INVALIDATE, success: "Stocktake closed." });
  const cancel = useApiMutation(() => apiClient.post(`/stocktakes/${id}/cancel`), { invalidate: INVALIDATE, success: "Stocktake cancelled." });

  if (query.isLoading) return <p className="text-muted" aria-busy="true">Loading the stocktake…</p>;
  if (query.error) return <ErrorState message={getErrorMessage(query.error, "Couldn't load the stocktake.")} onRetry={query.refetch} />;
  const stocktake = query.data;
  const progress = stocktake.progress;
  const isOpen = stocktake.status === "open";

  function submitScans(event) {
    event.preventDefault();
    const barcodes = [...new Set(input.split(/\s+/).map((code) => code.trim().toUpperCase()).filter(Boolean))];
    if (!barcodes.length) return;
    for (let index = 0; index < barcodes.length; index += 500) scan.mutate(barcodes.slice(index, index + 500));
    setInput("");
  }

  async function handleClose() {
    const ok = await confirm({
      title: "Close this stocktake?",
      message: apply
        ? `${progress.missing.length} unfound cop(ies) will be marked missing and ${progress.foundAgain.length} found cop(ies) made available again.`
        : "The results are kept but no copy changes status.",
      confirmLabel: "Close stocktake",
      tone: "primary",
    });
    if (ok) close.mutate();
  }

  async function handleCancel() {
    if (await confirm({ title: "Cancel this stocktake?", message: "The scans are discarded and nothing changes.", confirmLabel: "Cancel stocktake" })) cancel.mutate();
  }

  return (
    <>
      <button type="button" className="btn btn-link px-0 mb-2" onClick={onBack}>
        <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>All stocktakes
      </button>
      <PageHeader
        title={`Stocktake · ${stocktake.branch?.name}${stocktake.location ? ` · ${stocktake.location.code}` : ""}`}
        documentTitle="Stocktake"
        description={`Started ${formatDateTime(stocktake.createdAt)}`}
        actions={<StatusBadge status={stocktake.status} />}
      />
      <div className="row g-3 mb-3">
        {[
          ["Expected on the shelves", progress.expected],
          ["Scanned", progress.scanned],
          ["Not found yet", progress.missing.length],
        ].map(([label, value]) => (
          <div className="col-4" key={label}>
            <div className="stat-tile">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          </div>
        ))}
      </div>
      {isOpen && (
        <form className="card card-body mb-3" onSubmit={submitScans}>
          <label htmlFor="scan-input" className="form-label">
            Scan barcodes (one per line)
          </label>
          <textarea id="scan-input" className="form-control scan-input mb-2" rows={4} value={input} onChange={(event) => setInput(event.target.value)} />
          <div>
            <button type="submit" className="btn btn-primary" disabled={scan.isPending}>
              {scan.isPending ? <Spinner label="Recording" /> : "Record scans"}
            </button>
          </div>
        </form>
      )}
      <div className="card card-body mb-3">
        <div className="row g-3">
          <BarcodeList title="Not found" barcodes={progress.missing} tone="warning" />
          <BarcodeList title="Found again" barcodes={progress.foundAgain} tone="success" />
          <BarcodeList title="Unexpected here" barcodes={progress.unexpected} tone="info" />
        </div>
      </div>
      {stocktake.result && (
        <p className="small text-muted">
          Result: {stocktake.result.found} of {stocktake.result.expected} found, {stocktake.result.missing} missing, {stocktake.result.foundAgain} found again ·{" "}
          {stocktake.result.applied ? "statuses updated" : "statuses not changed"}.
        </p>
      )}
      {isOpen && (
        <div className="d-flex flex-wrap gap-3 align-items-center">
          <div className="form-check">
            <input id="apply-results" type="checkbox" className="form-check-input" checked={apply} onChange={(event) => setApply(event.target.checked)} />
            <label htmlFor="apply-results" className="form-check-label">
              Update copy statuses when closing
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleClose} disabled={close.isPending}>
            Close stocktake
          </button>
          <button type="button" className="btn btn-ghost-danger" onClick={handleCancel} disabled={cancel.isPending}>
            Cancel stocktake
          </button>
        </div>
      )}
    </>
  );
}

/** Staff page: stocktakes per branch. */
export default function StocktakesPage() {
  const branches = useActiveBranches().data;
  const { filters, params, setFilter, setPage } = useListState({ branch: "", status: "" });
  const query = usePagedQuery(["stocktakes"], "/stocktakes", params);
  const [starting, setStarting] = useState(false);
  const [openId, setOpenId] = useState(null);
  const start = useApiMutation((body) => apiClient.post("/stocktakes", body), { invalidate: [["stocktakes"]], success: "Stocktake started." });

  if (openId) return <StocktakeSession id={openId} onBack={() => setOpenId(null)} />;

  const columns = [
    { key: "branch", header: "Branch", render: (item) => `${item.branch?.name ?? ""}${item.location ? ` · ${item.location.code}` : ""}` },
    { key: "createdAt", header: "Started", render: (item) => formatDateTime(item.createdAt) },
    { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "result", header: "Result", hideBelow: "md", render: (item) => (item.result ? `${item.result.found}/${item.result.expected} found, ${item.result.missing} missing` : "—") },
    {
      key: "open",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end",
      render: (item) => (
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setOpenId(item._id)}>
          {item.status === "open" ? "Continue" : "View"}
        </button>
      ),
    },
  ];

  const toolbar = (
    <>
      <select className="form-select form-select-sm" style={{ maxWidth: 200 }} aria-label="Branch" value={filters.branch} onChange={(event) => setFilter("branch", event.target.value)}>
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id}>
            {branch.name}
          </option>
        ))}
      </select>
      <select className="form-select form-select-sm" style={{ maxWidth: 160 }} aria-label="Status" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
        <option value="">Any status</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </>
  );

  return (
    <>
      <PageHeader
        title="Stocktakes"
        description="Scan what is on the shelves and reconcile it with the records."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setStarting(true)}>
            <i className="bi bi-clipboard-check me-1" aria-hidden="true"></i>Start stocktake
          </button>
        }
      />
      <DataTable columns={columns} query={query} toolbar={toolbar} onPageChange={setPage} caption="Stocktakes" empty={{ icon: "clipboard-check", title: "No stocktakes yet" }} />
      {starting && (
        <Modal
          title="Start a stocktake"
          onClose={() => !start.isPending && setStarting(false)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setStarting(false)} disabled={start.isPending}>
                Cancel
              </button>
              <button type="submit" form="stocktake-form" className="btn btn-primary" disabled={start.isPending}>
                {start.isPending ? <Spinner label="Starting" /> : "Start"}
              </button>
            </>
          }
        >
          <StartForm
            onSubmit={(body) =>
              start.mutateAsync(body).then(
                (stocktake) => {
                  setStarting(false);
                  setOpenId(stocktake._id);
                },
                () => {}
              )
            }
          />
        </Modal>
      )}
    </>
  );
}
