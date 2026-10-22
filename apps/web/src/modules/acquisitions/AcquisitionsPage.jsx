import React, { useState } from "react";
import BookPicker from "../copies/BookPicker.jsx";
import { openProtectedFile } from "../copies/blob.js";
import SimpleCrudSection from "../authors/SimpleCrudSection.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import FormField from "../../components/ui/FormField.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import useListState from "../../hooks/useListState.js";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { apiClient, useApiMutation, useDataQuery, usePagedQuery } from "../../lib/resource.js";
import { formatDate, formatMoney, formatTitle, humanize, toMinorUnits } from "../../lib/format.js";
import { useActiveBranches } from "../branches/branch.queries.js";

const STATUSES = ["requested", "approved", "ordered", "partially_received", "received", "rejected", "cancelled"];
const INVALIDATE = [["purchase-orders"], ["copies"], ["reports"]];

/** Active suppliers for selects. */
function useSuppliers() {
  const query = usePagedQuery(["suppliers", "options"], "/suppliers", { isActive: true, limit: 100 });
  return query.data?.data ?? [];
}

const emptyLine = () => ({ book: null, title: "", isbn: "", quantity: 1, unitCost: "" });
const lineFrom = (line) => ({ book: line.book ?? null, title: line.title ?? "", isbn: line.isbn ?? "", quantity: line.quantity, unitCost: line.unitCost ? (line.unitCost / 100).toFixed(2) : "" });

/** Requested titles: a catalogued book, or a free-text title/ISBN not yet catalogued. */
function LinesEditor({ lines, onChange, error }) {
  const update = (index, changes) => onChange(lines.map((line, position) => (position === index ? { ...line, ...changes } : line)));
  return (
    <fieldset className="mb-3">
      <legend className="form-label">Titles</legend>
      {lines.map((line, index) => (
        <div className="border rounded p-2 mb-2" key={index}>
          {line.book ? (
            <BookPicker label={`Title ${index + 1}`} value={line.book} onChange={(book) => update(index, { book })} />
          ) : (
            <div className="row g-2">
              <div className="col-12">
                <BookPicker label={`Title ${index + 1} from the catalogue`} value={null} onChange={(book) => update(index, { book })} />
              </div>
              <div className="col-sm-8">
                <FormField label="…or a title not catalogued yet" className="" value={line.title} onChange={(event) => update(index, { title: event.target.value })} />
              </div>
              <div className="col-sm-4">
                <FormField label="ISBN" className="" value={line.isbn} onChange={(event) => update(index, { isbn: event.target.value })} />
              </div>
            </div>
          )}
          <div className="row g-2 align-items-end">
            <div className="col-5 col-sm-4">
              <FormField label="Quantity" type="number" min="1" className="" value={line.quantity} onChange={(event) => update(index, { quantity: event.target.value })} />
            </div>
            <div className="col-7 col-sm-5">
              <FormField label="Unit cost" type="number" min="0" step="0.01" className="" value={line.unitCost} onChange={(event) => update(index, { unitCost: event.target.value })} />
            </div>
            <div className="col-sm-3 text-end">
              {lines.length > 1 && (
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => onChange(lines.filter((_, position) => position !== index))}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-light" onClick={() => onChange([...lines, emptyLine()])}>
        <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Add a title
      </button>
      {error && <div className="invalid-feedback d-block">{error}</div>}
    </fieldset>
  );
}

const toApiLines = (lines) =>
  lines.map((line) => ({
    ...(line.book ? { book: line.book._id } : { title: line.title.trim(), ...(line.isbn.trim() && { isbn: line.isbn.trim() }) }),
    quantity: Number(line.quantity),
    unitCost: line.unitCost === "" ? 0 : toMinorUnits(line.unitCost),
  }));

function validateLines(lines) {
  if (!lines.length) return "Add at least one title.";
  for (const line of lines) {
    if (!line.book && !line.title.trim()) return "Each line needs a catalogued book or a title.";
    if (!(Number(line.quantity) >= 1)) return "Quantities must be at least 1.";
    if (line.unitCost !== "" && !(Number(line.unitCost) >= 0)) return "Costs cannot be negative.";
  }
  return null;
}

function PurchaseForm({ order, onSubmit }) {
  const branches = useActiveBranches().data;
  const suppliers = useSuppliers();
  const [branch, setBranch] = useState(order?.branch?._id ?? "");
  const [supplier, setSupplier] = useState(order?.supplier?._id ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [lines, setLines] = useState(order ? order.lines.map(lineFrom) : [emptyLine()]);
  const [errors, setErrors] = useState({});

  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!order && !branch) next.branch = "Choose the receiving branch.";
    const linesError = validateLines(lines);
    if (linesError) next.lines = linesError;
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ ...(!order && { branch }), ...(supplier && { supplier }), notes, lines: toApiLines(lines) });
  }

  return (
    <form id="purchase-form" onSubmit={submit} noValidate>
      {!order && (
        <FormField label="Receiving branch" as="select" value={branch} onChange={(event) => setBranch(event.target.value)} error={errors.branch}>
          <option value="">Choose…</option>
          {branches.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
            </option>
          ))}
        </FormField>
      )}
      <FormField label="Supplier" as="select" value={supplier} onChange={(event) => setSupplier(event.target.value)} hint="Required before ordering.">
        <option value="">Not chosen yet</option>
        {suppliers.map((item) => (
          <option key={item._id} value={item._id}>
            {item.name}
          </option>
        ))}
      </FormField>
      <LinesEditor lines={lines} onChange={setLines} error={errors.lines} />
      <FormField label="Notes" as="textarea" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
    </form>
  );
}

function ReceiveForm({ order, onSubmit }) {
  const [reference, setReference] = useState("");
  const [quantities, setQuantities] = useState(() => Object.fromEntries(order.lines.map((line) => [line._id, String(line.quantity - line.received)])));
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    const lines = order.lines
      .map((line) => ({ line: line._id, quantity: Number(quantities[line._id] || 0), remaining: line.quantity - line.received }))
      .filter((line) => line.quantity > 0);
    if (!lines.length) return setError("Enter how many copies arrived.");
    if (lines.some((line) => line.quantity > line.remaining || !Number.isInteger(line.quantity))) return setError("You can't receive more than was ordered.");
    return onSubmit({ reference, lines: lines.map(({ line, quantity }) => ({ line, quantity })) });
  }
  return (
    <form id="receive-form" onSubmit={submit} noValidate>
      <p className="small text-muted">Received copies are added to the branch's inventory with generated barcodes and the unit cost.</p>
      {order.lines.map((line) => {
        const remaining = line.quantity - line.received;
        return (
          <FormField
            key={line._id}
            label={`${formatTitle(line.book?.bookTitle ?? line.title ?? "")} (${line.received} of ${line.quantity} received)`}
            type="number"
            min="0"
            max={remaining}
            disabled={remaining === 0}
            value={quantities[line._id]}
            onChange={(event) => setQuantities((current) => ({ ...current, [line._id]: event.target.value }))}
          />
        );
      })}
      <FormField label="Delivery note / invoice number" value={reference} onChange={(event) => setReference(event.target.value)} error={error} />
    </form>
  );
}

/** One purchase order: lines, totals, deliveries, documents and the actions its status allows. */
function PurchaseOrderDetail({ id, onClose }) {
  const query = useDataQuery(["purchase-orders", id], `/purchase-orders/${id}`);
  const [mode, setMode] = useState(null); // "edit" | "receive"
  const act = useApiMutation(({ action }) => apiClient.post(`/purchase-orders/${id}/${action}`, {}), {
    invalidate: INVALIDATE,
    success: (_result, { action }) => ({ approve: "Request approved.", reject: "Request rejected.", cancel: "Order cancelled.", order: "Order placed with the supplier." })[action],
  });
  const update = useApiMutation((body) => apiClient.patch(`/purchase-orders/${id}`, body), { invalidate: INVALIDATE, success: "Order updated." });
  const receive = useApiMutation((body) => apiClient.post(`/purchase-orders/${id}/deliveries`, body), { invalidate: INVALIDATE, success: "Delivery recorded and copies added." });
  const upload = useApiMutation((formData) => apiClient.post(`/purchase-orders/${id}/documents`, formData), { invalidate: [["purchase-orders"]], success: "Document attached." });

  const order = query.data;
  const busy = act.isPending || update.isPending || receive.isPending;

  async function run(action) {
    if (["reject", "cancel"].includes(action)) {
      const ok = await confirm({ title: `${humanize(action)} this order?`, message: "This can't be undone.", confirmLabel: humanize(action) });
      if (!ok) return;
    }
    act.mutate({ action });
  }

  function attach(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    upload.mutate(formData);
    event.target.value = "";
  }

  async function download(document) {
    try {
      await openProtectedFile(`/purchase-orders/${id}/documents/${document._id}`, { fileName: document.name, download: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't download the document."));
    }
  }

  let body;
  if (query.isLoading) body = <p className="text-muted" aria-busy="true">Loading…</p>;
  else if (query.error) body = <ErrorState message={getErrorMessage(query.error, "Couldn't load the order.")} onRetry={query.refetch} />;
  else if (mode === "edit") body = <PurchaseForm order={order} onSubmit={(values) => update.mutateAsync(values).then(() => setMode(null), () => {})} />;
  else if (mode === "receive") body = <ReceiveForm order={order} onSubmit={(values) => receive.mutateAsync(values).then(() => setMode(null), () => {})} />;
  else {
    body = (
      <>
        <p className="mb-2">
          <StatusBadge status={order.status} /> <span className="ms-2">{order.branch?.name}</span> · {order.supplier?.name ?? "No supplier yet"}
        </p>
        <div className="table-responsive">
          <table className="table table-sm data-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col" className="text-end">Qty</th>
                <th scope="col" className="text-end">Received</th>
                <th scope="col" className="text-end">Unit cost</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line._id}>
                  <td className="text-capitalize">{formatTitle(line.book?.bookTitle ?? line.title ?? "")}</td>
                  <td className="text-end">{line.quantity}</td>
                  <td className="text-end">{line.received}</td>
                  <td className="text-end">{formatMoney(line.unitCost, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">
          Total {formatMoney(order.totalCost, order.currency)} · received {formatMoney(order.receivedCost, order.currency)}
        </p>
        {order.notes && <p className="small text-muted">{order.notes}</p>}
        {order.deliveries.length > 0 && (
          <>
            <h3 className="h6">Deliveries</h3>
            <ul className="small">
              {order.deliveries.map((delivery) => (
                <li key={delivery._id}>
                  {formatDate(delivery.receivedAt)} — {delivery.lines.reduce((sum, line) => sum + line.quantity, 0)} cop(ies){delivery.reference && ` · ${delivery.reference}`}
                </li>
              ))}
            </ul>
          </>
        )}
        <h3 className="h6">Documents</h3>
        <ul className="small list-unstyled">
          {order.documents.map((document) => (
            <li key={document._id}>
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => download(document)}>
                <i className="bi bi-file-earmark-arrow-down me-1" aria-hidden="true"></i>
                {document.name}
              </button>
            </li>
          ))}
          {!order.documents.length && <li className="text-muted">None</li>}
        </ul>
        <label className="btn btn-sm btn-light mb-3">
          {upload.isPending ? <Spinner label="Uploading" /> : "Attach a document"}
          <input type="file" className="visually-hidden" accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx" onChange={attach} aria-label="Attach a document" />
        </label>
        <div className="d-flex flex-wrap gap-2">
          {order.status === "requested" && (
            <>
              <button type="button" className="btn btn-primary" onClick={() => run("approve")} disabled={busy}>Approve</button>
              <button type="button" className="btn btn-outline-danger" onClick={() => run("reject")} disabled={busy}>Reject</button>
            </>
          )}
          {order.status === "approved" && <button type="button" className="btn btn-primary" onClick={() => run("order")} disabled={busy}>Place order</button>}
          {["ordered", "partially_received"].includes(order.status) && <button type="button" className="btn btn-primary" onClick={() => setMode("receive")} disabled={busy}>Receive delivery</button>}
          {["requested", "approved"].includes(order.status) && <button type="button" className="btn btn-light" onClick={() => setMode("edit")} disabled={busy}>Edit</button>}
          {["requested", "approved", "ordered"].includes(order.status) && <button type="button" className="btn btn-ghost-danger" onClick={() => run("cancel")} disabled={busy}>Cancel order</button>}
        </div>
      </>
    );
  }

  const form = { edit: "purchase-form", receive: "receive-form" }[mode];
  return (
    <Modal
      title={order?.number ? `Purchase order ${order.number}` : "Purchase request"}
      onClose={() => (mode ? setMode(null) : onClose())}
      footer={
        mode && (
          <>
            <button type="button" className="btn btn-light" onClick={() => setMode(null)} disabled={busy}>Back</button>
            <button type="submit" form={form} className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner label="Saving" /> : mode === "edit" ? "Save" : "Record delivery"}
            </button>
          </>
        )
      }
    >
      {body}
    </Modal>
  );
}

function PurchaseOrdersSection() {
  const { filters, params, setFilter, setPage } = useListState({ status: "" });
  const query = usePagedQuery(["purchase-orders"], "/purchase-orders", params);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const create = useApiMutation((body) => apiClient.post("/purchase-orders", body), { invalidate: INVALIDATE, success: "Purchase request created." });

  const columns = [
    { key: "number", header: "Order", render: (order) => order.number ?? <span className="text-muted">Request</span> },
    { key: "supplier", header: "Supplier", hideBelow: "md", render: (order) => order.supplier?.name ?? "—" },
    { key: "branch", header: "Branch", hideBelow: "lg", render: (order) => order.branch?.code },
    { key: "lines", header: "Titles", hideBelow: "md", render: (order) => order.lines.length },
    { key: "total", header: "Total", className: "text-end", render: (order) => formatMoney(order.totalCost, order.currency) },
    { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
    { key: "createdAt", header: "Created", hideBelow: "lg", render: (order) => formatDate(order.createdAt) },
    {
      key: "open",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end",
      render: (order) => (
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setOpenId(order._id)} aria-label={`Open ${order.number ?? "request"} from ${formatDate(order.createdAt)}`}>
          Open
        </button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        query={query}
        onPageChange={setPage}
        caption="Purchase orders"
        toolbar={
          <>
            <select className="form-select form-select-sm" style={{ maxWidth: 200 }} aria-label="Status" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
              <option value="">Any status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>{humanize(status)}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => setCreating(true)}>
              <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>New request
            </button>
          </>
        }
        empty={{ icon: "cart-check", title: "No purchase orders yet" }}
      />
      {creating && (
        <Modal
          title="New purchase request"
          onClose={() => !create.isPending && setCreating(false)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setCreating(false)} disabled={create.isPending}>Cancel</button>
              <button type="submit" form="purchase-form" className="btn btn-primary" disabled={create.isPending}>
                {create.isPending ? <Spinner label="Saving" /> : "Create request"}
              </button>
            </>
          }
        >
          <PurchaseForm onSubmit={(body) => create.mutateAsync(body).then(() => setCreating(false), () => {})} />
        </Modal>
      )}
      {openId && <PurchaseOrderDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

const SUPPLIER_FIELDS = [
  { name: "name", label: "Name", required: true },
  { name: "contactName", label: "Contact person" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address" },
  { name: "notes", label: "Notes", type: "textarea" },
  { name: "isActive", label: "Active (can receive new orders)", type: "checkbox" },
];

/** Staff page: suppliers and the purchase workflow. */
export default function AcquisitionsPage() {
  const [tab, setTab] = useState("orders");
  return (
    <>
      <PageHeader title="Acquisitions" description="Purchase requests → approval → orders → deliveries into inventory." />
      <ul className="nav nav-tabs mb-3" role="tablist">
        {[["orders", "Purchase orders"], ["suppliers", "Suppliers"]].map(([id, label]) => (
          <li className="nav-item" role="presentation" key={id}>
            <button type="button" role="tab" aria-selected={tab === id} className={`nav-link ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      {tab === "orders" ? (
        <PurchaseOrdersSection />
      ) : (
        <SimpleCrudSection
          entity="Supplier"
          queryKey={["suppliers", "admin"]}
          url="/suppliers"
          invalidate={[["suppliers"]]}
          searchPlaceholder="Search suppliers"
          fields={SUPPLIER_FIELDS}
          columns={[
            { key: "name", header: "Name", render: (supplier) => <span className="fw-semibold">{supplier.name}</span> },
            { key: "contactName", header: "Contact", hideBelow: "md" },
            { key: "email", header: "Email", hideBelow: "lg" },
            { key: "isActive", header: "Status", render: (supplier) => <StatusBadge status={supplier.isActive ? "active" : "closed"} label={supplier.isActive ? "Active" : "Inactive"} /> },
          ]}
          toForm={(supplier) => Object.fromEntries(SUPPLIER_FIELDS.map((field) => [field.name, supplier[field.name] ?? (field.type === "checkbox" ? true : "")]))}
        />
      )}
    </>
  );
}
