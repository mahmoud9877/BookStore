import React, { useState } from "react";
import Modal from "../../../components/ui/Modal.jsx";
import ModalFormActions from "../../../components/ui/ModalFormActions.jsx";
import DataTable from "../../../components/ui/DataTable.jsx";
import StatusBadge from "../../../components/ui/StatusBadge.jsx";
import { confirm } from "../../../components/ui/confirm.store.js";
import { apiClient, usePagedQuery, useApiMutation } from "../../../lib/resource.js";
import { msg, t, tp } from "../../../i18n/index.js";

const KEY = ["membership-types"];
const NEW = Symbol("new type");
const NUMBER_FIELDS = [
  ["loanLimit", msg("Items on loan at once")],
  ["loanPeriodDays", msg("Loan period (days)")],
  ["maxRenewals", msg("Renewals per loan")],
  ["reservationLimit", msg("Open reservations")],
  ["membershipMonths", msg("Membership length (months)")],
];

const EMPTY = { code: "", name: "", description: "", loanLimit: 5, loanPeriodDays: 14, maxRenewals: 2, reservationLimit: 5, membershipMonths: 12, canAccessDigital: true, isActive: true };

function TypeForm({ type, onSubmit }) {
  const [values, setValues] = useState(() => ({ ...EMPTY, ...(type ?? {}) }));
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const payload = { name: values.name, description: values.description, canAccessDigital: values.canAccessDigital, isActive: values.isActive };
    for (const [key] of NUMBER_FIELDS) payload[key] = Number(values[key]);
    if (!type) payload.code = values.code;
    onSubmit(payload);
  };
  return (
    <form id="type-form" onSubmit={submit}>
      <div className="row g-3">
        <div className="col-sm-4">
          <label htmlFor="type-code" className="form-label">{t("Code")}</label>
          <input id="type-code" className="form-control text-uppercase" required maxLength={20} pattern="[A-Za-z0-9_-]+" value={values.code} disabled={Boolean(type)} onChange={(event) => set("code", event.target.value)} />
        </div>
        <div className="col-sm-8">
          <label htmlFor="type-name" className="form-label">{t("Name")}</label>
          <input id="type-name" className="form-control" required maxLength={100} value={values.name} onChange={(event) => set("name", event.target.value)} />
        </div>
        <div className="col-12">
          <label htmlFor="type-description" className="form-label">{t("Description")}</label>
          <input id="type-description" className="form-control" maxLength={500} value={values.description ?? ""} onChange={(event) => set("description", event.target.value)} />
        </div>
        {NUMBER_FIELDS.map(([key, label]) => (
          <div className="col-6 col-sm-4" key={key}>
            <label htmlFor={`type-${key}`} className="form-label small">{t(label)}</label>
            <input id={`type-${key}`} type="number" className="form-control" min={key === "loanPeriodDays" || key === "membershipMonths" ? 1 : 0} required value={values[key]} onChange={(event) => set(key, event.target.value)} />
          </div>
        ))}
        <div className="col-12">
          <div className="form-check">
            <input id="type-digital" className="form-check-input" type="checkbox" checked={values.canAccessDigital} onChange={(event) => set("canAccessDigital", event.target.checked)} />
            <label className="form-check-label" htmlFor="type-digital">{t("Includes the digital library")}</label>
          </div>
          <div className="form-check">
            <input id="type-active" className="form-check-input" type="checkbox" checked={values.isActive} onChange={(event) => set("isActive", event.target.checked)} />
            <label className="form-check-label" htmlFor="type-active">{t("Offered to new members")}</label>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Membership types: the borrowing limits each kind of member gets. */
export default function MembershipTypesPanel() {
  const query = usePagedQuery(KEY, "/membership-types", { limit: 100, sort: "name" });
  const [editing, setEditing] = useState(null);
  const edited = editing === NEW ? null : editing;
  const save = useApiMutation(
    ({ id, payload }) => (id ? apiClient.patch(`/membership-types/${id}`, payload) : apiClient.post("/membership-types", payload)),
    { invalidate: [KEY], success: (result) => t("Saved “{name}”.", { name: result.name }) }
  );
  const remove = useApiMutation((id) => apiClient.delete(`/membership-types/${id}`), { invalidate: [KEY], success: t("Membership type deleted.") });

  async function handleSave(payload) {
    await save.mutateAsync({ id: edited?._id, payload }).then(() => setEditing(null), () => {});
  }

  async function handleDelete(type) {
    const ok = await confirm({ title: t("Delete this membership type?"), message: t("“{name}” will be removed. Types still held by members can't be deleted — deactivate them instead.", { name: type.name }), confirmLabel: t("Delete") });
    if (ok) remove.mutate(type._id);
  }

  const columns = [
    { key: "name", header: t("Type"), render: (type) => (<><div className="fw-semibold">{type.name}</div><div className="small text-muted">{type.code}</div></>) },
    { key: "limits", header: t("Loans"), render: (type) => t("{limit} × {period}, {renewals}", { limit: type.loanLimit, period: tp("day", type.loanPeriodDays), renewals: tp("renewal", type.maxRenewals) }) },
    { key: "reservationLimit", header: t("Reservations"), hideBelow: "md" },
    { key: "membershipMonths", header: t("Months"), hideBelow: "md" },
    { key: "status", header: t("Status"), render: (type) => <StatusBadge status={type.isActive ? "active" : "closed"} label={type.isActive ? t("Offered") : t("Retired")} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">{t("Actions")}</span>,
      className: "text-end text-nowrap",
      render: (type) => (
        <>
          <button type="button" className="btn btn-sm btn-ghost" aria-label={t("Edit {name}", { name: type.name })} onClick={() => setEditing(type)}>
            <i className="bi bi-pencil" aria-hidden="true"></i>
          </button>
          <button type="button" className="btn btn-sm btn-ghost-danger" aria-label={t("Delete {name}", { name: type.name })} onClick={() => handleDelete(type)}>
            <i className="bi bi-trash3" aria-hidden="true"></i>
          </button>
        </>
      ),
    },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-end mb-2 gap-2 flex-wrap">
        <p className="text-muted small mb-0">{t("Each member has one type. It decides how many items they may borrow, for how long, and how often they may renew.")}</p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(NEW)}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>{t("New type")}
        </button>
      </div>
      <DataTable caption={t("Membership types")} columns={columns} query={query} empty={{ icon: "person-vcard", title: t("No membership types yet") }} />
      {editing && (
        <Modal
          title={edited ? t("Edit {name}", { name: edited.name }) : t("New membership type")}
          onClose={() => !save.isPending && setEditing(null)}
          footer={<ModalFormActions formId="type-form" onCancel={() => setEditing(null)} isPending={save.isPending} submitLabel={t("Save")} />}
        >
          <TypeForm type={edited} onSubmit={handleSave} />
        </Modal>
      )}
    </>
  );
}
