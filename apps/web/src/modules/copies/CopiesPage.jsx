import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookPicker from "./BookPicker.jsx";
import { ADJUSTMENT_TRANSITIONS, COPY_CONDITIONS, COPY_STATUSES } from "./copy-statuses.js";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import FormField from "../../components/ui/FormField.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import useListState from "../../hooks/useListState.js";
import { apiClient, fetchJson, useApiMutation, usePagedQuery } from "../../lib/resource.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { toast } from "../../components/ui/toast.store.js";
import { formatDate, formatMoney, formatTitle, humanize, toMinorUnits } from "../../lib/format.js";
import { useActiveBranches, useLocations } from "../branches/branch.queries.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS } from "../auth/permissions.js";

const INVALIDATE = [["copies"], ["books"], ["reports"]];

function ShelfSelect({ branch, value, onChange }) {
  const { data: locations } = useLocations(branch);
  return (
    <FormField label="Shelf" as="select" value={value ?? ""} onChange={(event) => onChange(event.target.value)} disabled={!branch}>
      <option value="">No shelf</option>
      {locations
        .filter((location) => location.type === "shelf")
        .map((location) => (
          <option key={location._id} value={location._id}>
            {location.code} {location.name && `— ${location.name}`}
          </option>
        ))}
    </FormField>
  );
}

/** Adds copies of a book to a branch (barcodes generated unless typed). */
function AddCopiesForm({ initialBook, onSubmit }) {
  const branches = useActiveBranches().data;
  const [book, setBook] = useState(initialBook ?? null);
  const [values, setValues] = useState({ branch: "", location: "", count: 1, barcodes: "", condition: "new", cost: "", notes: "" });
  const [errors, setErrors] = useState({});
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));

  function submit(event) {
    event.preventDefault();
    const barcodes = values.barcodes.split(/\s+/).map((code) => code.trim().toUpperCase()).filter(Boolean);
    const count = barcodes.length || Number(values.count);
    const next = {};
    if (!book) next.book = "Choose a book.";
    if (!values.branch) next.branch = "Choose a branch.";
    if (!(count >= 1 && count <= 200)) next.count = "Add between 1 and 200 copies.";
    if (values.cost !== "" && !(Number(values.cost) >= 0)) next.cost = "Enter a cost of 0 or more.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      book: book._id,
      branch: values.branch,
      location: values.location || null,
      count,
      ...(barcodes.length && { barcodes }),
      condition: values.condition,
      ...(values.cost !== "" && { cost: toMinorUnits(values.cost) }),
      ...(values.notes && { notes: values.notes }),
    });
  }

  return (
    <form id="copies-form" onSubmit={submit} noValidate>
      <BookPicker value={book} onChange={setBook} error={errors.book} />
      <div className="row g-3">
        <div className="col-sm-6">
          <FormField label="Branch" as="select" className="" value={values.branch} onChange={(event) => setValues((current) => ({ ...current, branch: event.target.value, location: "" }))} error={errors.branch}>
            <option value="">Choose…</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-sm-6">
          <ShelfSelect branch={values.branch} value={values.location} onChange={(location) => setValues((current) => ({ ...current, location }))} />
        </div>
        <div className="col-6 col-sm-3">
          <FormField label="Copies" type="number" min="1" max="200" className="" value={values.count} onChange={set("count")} error={errors.count} disabled={Boolean(values.barcodes.trim())} />
        </div>
        <div className="col-6 col-sm-4">
          <FormField label="Condition" as="select" className="" value={values.condition} onChange={set("condition")}>
            {COPY_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {humanize(condition)}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-sm-5">
          <FormField label="Cost per copy" type="number" min="0" step="0.01" className="" hint="Optional, in the library currency" value={values.cost} onChange={set("cost")} error={errors.cost} />
        </div>
        <div className="col-12">
          <FormField label="Barcodes" as="textarea" rows={2} className="" hint="Optional: one per line or space-separated. Leave empty to generate them." value={values.barcodes} onChange={set("barcodes")} />
        </div>
        <div className="col-12">
          <FormField label="Notes" className="" value={values.notes} onChange={set("notes")} />
        </div>
      </div>
    </form>
  );
}

function EditCopyForm({ copy, onSubmit }) {
  const [values, setValues] = useState({
    location: copy.location?._id ?? "",
    condition: copy.condition,
    cost: copy.cost == null ? "" : (copy.cost / 100).toFixed(2),
    notes: copy.notes ?? "",
  });
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  function submit(event) {
    event.preventDefault();
    onSubmit({ location: values.location || null, condition: values.condition, cost: values.cost === "" ? null : toMinorUnits(values.cost), notes: values.notes });
  }
  return (
    <form id="copy-edit-form" onSubmit={submit} noValidate>
      <ShelfSelect branch={copy.branch?._id} value={values.location} onChange={(location) => setValues((current) => ({ ...current, location }))} />
      <FormField label="Condition" as="select" value={values.condition} onChange={set("condition")}>
        {COPY_CONDITIONS.map((condition) => (
          <option key={condition} value={condition}>
            {humanize(condition)}
          </option>
        ))}
      </FormField>
      <FormField label="Cost" type="number" min="0" step="0.01" value={values.cost} onChange={set("cost")} />
      <FormField label="Notes" value={values.notes} onChange={set("notes")} />
    </form>
  );
}

/** Manual status change: only transitions the API allows, always with a reason. */
function AdjustStatusForm({ copy, onSubmit }) {
  const options = ADJUSTMENT_TRANSITIONS[copy.status] ?? [];
  const [status, setStatus] = useState(options[0] ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    if (reason.trim().length < 3) return setError("Give a reason (at least 3 characters).");
    setError("");
    return onSubmit({ status, reason: reason.trim() });
  }
  if (!options.length) {
    return <p className="mb-0">A copy that is {humanize(copy.status).toLowerCase()} changes status only through its loan, hold or transfer.</p>;
  }
  return (
    <form id="adjust-form" onSubmit={submit} noValidate>
      <p className="small text-muted">
        Currently <StatusBadge status={copy.status} />. The change is recorded in the audit log.
      </p>
      <FormField label="New status" as="select" value={status} onChange={(event) => setStatus(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </FormField>
      <FormField label="Reason" as="textarea" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} error={error} />
    </form>
  );
}

/** Staff page: every physical copy, with adding, editing and inventory adjustments. */
export default function CopiesPage() {
  const [searchParams] = useSearchParams();
  const bookFilter = searchParams.get("book") ?? "";
  const branches = useActiveBranches().data;
  const { filters, params, setFilter, setPage } = useListState({ branch: "", status: "", search: "", book: bookFilter });
  const query = usePagedQuery(["copies"], "/copies", params);
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.CopiesManage);
  const [dialog, setDialog] = useState(null); // { type: "add" | "edit" | "adjust", copy? }
  const [lookup, setLookup] = useState("");
  const [initialBook, setInitialBook] = useState(null);

  const addCopies = useApiMutation((body) => apiClient.post("/copies", body), { invalidate: INVALIDATE, success: (copies) => `Added ${copies.length} cop${copies.length === 1 ? "y" : "ies"}.` });
  const editCopy = useApiMutation(({ id, ...body }) => apiClient.patch(`/copies/${id}`, body), { invalidate: INVALIDATE, success: "Copy updated." });
  const adjust = useApiMutation(({ id, ...body }) => apiClient.post(`/copies/${id}/status`, body), { invalidate: INVALIDATE, success: (copy) => `${copy.barcode} is now ${humanize(copy.status).toLowerCase()}.` });
  const pending = addCopies.isPending || editCopy.isPending || adjust.isPending;
  const close = () => !pending && setDialog(null);
  const run = (mutation, variables) => mutation.mutateAsync(variables).then(() => setDialog(null), () => {});

  async function openAdd() {
    if (bookFilter && !initialBook) {
      try {
        setInitialBook((await fetchJson(`/book/${bookFilter}`)).book ?? null);
      } catch {
        setInitialBook(null);
      }
    }
    setDialog({ type: "add" });
  }

  async function findBarcode(event) {
    event.preventDefault();
    if (!lookup.trim()) return;
    try {
      const { data } = await fetchJson(`/copies/barcode/${encodeURIComponent(lookup.trim().toUpperCase())}`);
      setDialog({ type: "adjust", copy: data });
      setLookup("");
    } catch (error) {
      toast.error(getErrorMessage(error, "No copy has this barcode."));
    }
  }

  const columns = [
    { key: "barcode", header: "Barcode", render: (copy) => <span className="scan-input fw-semibold">{copy.barcode}</span> },
    { key: "book", header: "Book", render: (copy) => <span className="text-capitalize">{formatTitle(copy.book?.bookTitle ?? "")}</span> },
    { key: "branch", header: "Branch", hideBelow: "md", render: (copy) => `${copy.branch?.code ?? ""}${copy.location ? ` · ${copy.location.code}` : ""}` },
    { key: "status", header: "Status", render: (copy) => <StatusBadge status={copy.status} /> },
    { key: "condition", header: "Condition", hideBelow: "lg", render: (copy) => humanize(copy.condition) },
    { key: "cost", header: "Cost", hideBelow: "lg", className: "text-end", render: (copy) => (copy.cost == null ? "—" : formatMoney(copy.cost)) },
    { key: "acquiredAt", header: "Acquired", hideBelow: "lg", render: (copy) => formatDate(copy.acquiredAt) },
    {
      key: "actions",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end text-nowrap",
      render: (copy) => (
        <>
          {canManage && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDialog({ type: "edit", copy })} aria-label={`Edit ${copy.barcode}`}>
              <i className="bi bi-pencil" aria-hidden="true"></i>
            </button>
          )}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDialog({ type: "adjust", copy })} aria-label={`Change status of ${copy.barcode}`}>
            <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
          </button>
        </>
      ),
    },
  ];

  const toolbar = (
    <>
      <form className="d-flex gap-2" onSubmit={findBarcode} role="search" aria-label="Find a copy by barcode">
        <input className="form-control form-control-sm scan-input" style={{ maxWidth: 200 }} placeholder="Scan a barcode" aria-label="Scan a barcode" value={lookup} onChange={(event) => setLookup(event.target.value)} />
        <button type="submit" className="btn btn-sm btn-outline-primary">
          Find
        </button>
      </form>
      <input type="search" className="form-control form-control-sm" style={{ maxWidth: 200 }} placeholder="Barcode starts with…" aria-label="Filter by barcode" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} />
      <select className="form-select form-select-sm" style={{ maxWidth: 200 }} aria-label="Branch" value={filters.branch} onChange={(event) => setFilter("branch", event.target.value)}>
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id}>
            {branch.name}
          </option>
        ))}
      </select>
      <select className="form-select form-select-sm" style={{ maxWidth: 180 }} aria-label="Status" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
        <option value="">Any status</option>
        {COPY_STATUSES.map((status) => (
          <option key={status} value={status}>
            {humanize(status)}
          </option>
        ))}
      </select>
      {filters.book && (
        <button type="button" className="btn btn-sm btn-light" onClick={() => setFilter("book", "")}>
          Showing one book · show all
        </button>
      )}
    </>
  );

  const dialogs = {
    add: { title: "Add copies", form: "copies-form", label: "Add copies", body: <AddCopiesForm initialBook={initialBook} onSubmit={(body) => run(addCopies, body)} /> },
    edit: { title: `Edit ${dialog?.copy?.barcode}`, form: "copy-edit-form", label: "Save", body: dialog?.copy && <EditCopyForm copy={dialog.copy} onSubmit={(body) => run(editCopy, { id: dialog.copy._id, ...body })} /> },
    adjust: {
      title: `Change status of ${dialog?.copy?.barcode}`,
      form: "adjust-form",
      label: "Change status",
      hideSubmit: dialog?.copy && !(ADJUSTMENT_TRANSITIONS[dialog.copy.status] ?? []).length,
      body: dialog?.copy && <AdjustStatusForm copy={dialog.copy} onSubmit={(body) => run(adjust, { id: dialog.copy._id, ...body })} />,
    },
  };
  const active = dialog && dialogs[dialog.type];

  return (
    <>
      <PageHeader
        title="Copies"
        description={query.data ? `${query.data.meta.total} physical copies` : "Physical items, their shelves and condition"}
        actions={
          canManage && (
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Add copies
            </button>
          )
        }
      />
      <DataTable columns={columns} query={query} toolbar={toolbar} onPageChange={setPage} caption="Copies" empty={{ icon: "upc", title: "No copies match", message: "Add copies of a book, or change the filters." }} />
      {active && (
        <Modal
          title={active.title}
          onClose={close}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={close} disabled={pending}>
                {active.hideSubmit ? "Close" : "Cancel"}
              </button>
              {!active.hideSubmit && (
                <button type="submit" form={active.form} className="btn btn-primary" disabled={pending}>
                  {pending ? <Spinner label="Saving" /> : active.label}
                </button>
              )}
            </>
          }
        >
          {active.body}
        </Modal>
      )}
    </>
  );
}
