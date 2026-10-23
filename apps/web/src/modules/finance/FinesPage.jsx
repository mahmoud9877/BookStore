import React, { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import FormField from "../../components/ui/FormField.jsx";
import useListState from "../../hooks/useListState.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../lib/resource.js";
import { formatDate, formatDateTime, formatMoney, humanize, toMinorUnits } from "../../lib/format.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { t } from "../../i18n/index.js";
import { useMemberLookup } from "../circulation/useMemberLookup.js";
import ReasonModal from "../circulation/ReasonModal.jsx";
import CashPaymentModal from "./CashPaymentModal.jsx";
import { FINANCE_KEYS } from "./finance-keys.js";

function memberLink(member) {
  return member ? <Link to={`/dashboard/members/${member._id}`}>{member.name}</Link> : "—";
}

function ManualFineModal({ onClose }) {
  const [memberRef, setMemberRef] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const member = useMemberLookup(memberRef);
  const add = useApiMutation((body) => apiClient.post("/fines", body), { invalidate: FINANCE_KEYS, success: t("Fine added.") });

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!member.data) next.member = t("Enter a valid member number.");
    if (!(toMinorUnits(amount) > 0)) next.amount = t("Enter an amount greater than zero.");
    if (reason.trim().length < 3) next.reason = t("Enter a reason.");
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await add.mutateAsync({ member: member.data._id, amount: toMinorUnits(amount), reason: reason.trim() });
      onClose();
    } catch {
      // Reported by the mutation.
    }
  }

  return (
    <Modal
      title={t("Add a fine")}
      size="sm"
      onClose={() => !add.isPending && onClose()}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="submit" form="manual-fine-form" className="btn btn-primary" disabled={add.isPending}>
            {add.isPending ? <Spinner label={t("Adding")} /> : t("Add fine")}
          </button>
        </>
      }
    >
      <form id="manual-fine-form" onSubmit={submit} noValidate>
        <FormField label={t("Member number")} value={memberRef} onChange={(event) => setMemberRef(event.target.value)} error={errors.member} hint={member.data?.name} autoComplete="off" />
        <FormField label={t("Amount")} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} error={errors.amount} />
        <FormField label={t("Reason")} className="" value={reason} onChange={(event) => setReason(event.target.value)} error={errors.reason} />
      </form>
    </Modal>
  );
}

/** Fines with waive actions. Reused on the member page (`member` filter). */
export function FinesTable({ member, toolbar: extraToolbar }) {
  const { can } = usePermissions();
  const { filters, params, setFilter, setPage } = useListState({ status: member ? "" : "outstanding", type: "" });
  const query = usePagedQuery(["fines", "list"], "/fines", { ...params, member });
  const [waiving, setWaiving] = useState(null);
  const waive = useApiMutation(({ id, amount, reason }) => apiClient.post(`/fines/${id}/waive`, { amount, reason }), {
    invalidate: FINANCE_KEYS,
    success: t("Fine waived."),
  });

  const columns = [
    { key: "createdAt", header: t("Date"), render: (fine) => formatDate(fine.createdAt) },
    ...(member ? [] : [{ key: "member", header: t("Member"), render: (fine) => memberLink(fine.member) }]),
    { key: "type", header: t("Type"), render: (fine) => humanize(fine.type) },
    { key: "reason", header: t("Reason"), render: (fine) => <span className="small">{fine.reason}</span>, hideBelow: "lg" },
    { key: "amount", header: t("Amount"), className: "text-end", render: (fine) => formatMoney(fine.amount, fine.currency) },
    { key: "balance", header: t("Owed"), className: "text-end", render: (fine) => formatMoney(fine.balance, fine.currency) },
    { key: "status", header: t("Status"), render: (fine) => <StatusBadge status={fine.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">{t("Actions")}</span>,
      className: "text-end",
      render: (fine) =>
        can(PERMISSIONS.FinesManage) && fine.status === "outstanding" ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setWaiving(fine)} aria-label={t("Waive fine of {amount}", { amount: formatMoney(fine.balance) })}>
            {t("Waive")}
          </button>
        ) : null,
    },
  ];

  const toolbar = (
    <>
      <div>
        <label htmlFor="fine-status" className="form-label small mb-1">
          {t("Status")}
        </label>
        <select id="fine-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">{t("All")}</option>
          <option value="outstanding">{t("Outstanding")}</option>
          <option value="paid">{t("Paid")}</option>
          <option value="waived">{t("Waived")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="fine-type" className="form-label small mb-1">
          {t("Type")}
        </label>
        <select id="fine-type" className="form-select form-select-sm" value={filters.type} onChange={(event) => setFilter("type", event.target.value)}>
          <option value="">{t("All")}</option>
          {["overdue", "lost", "damaged", "manual"].map((type) => (
            <option key={type} value={type}>
              {humanize(type)}
            </option>
          ))}
        </select>
      </div>
      {extraToolbar}
    </>
  );

  return (
    <>
      <DataTable columns={columns} query={query} onPageChange={setPage} toolbar={toolbar} caption={t("Fines")} empty={{ icon: "cash-coin", title: t("No fines match") }} />
      {waiving && (
        <ReasonModal
          title={t("Waive this fine?")}
          confirmLabel={t("Waive")}
          tone="primary"
          amount={{ label: t("Amount to waive"), max: waiving.balance / 100, defaultValue: String(waiving.balance / 100), hint: t("Owed: {amount}", { amount: formatMoney(waiving.balance) }) }}
          onClose={() => setWaiving(null)}
          onSubmit={({ amount, reason }) => waive.mutateAsync({ id: waiving._id, amount: toMinorUnits(amount), reason })}
        />
      )}
    </>
  );
}

/** Payments with refunds. Reused on the member page (`member` filter). */
export function PaymentsTable({ member, toolbar: extraToolbar }) {
  const { can } = usePermissions();
  const { filters, params, setFilter, setPage } = useListState({ status: "", method: "" });
  const query = usePagedQuery(["payments", "list"], "/payments", { ...params, member }, { enabled: can(PERMISSIONS.PaymentsManage) });
  const [refunding, setRefunding] = useState(null);
  const refund = useApiMutation(({ id, amount, reason }) => apiClient.post(`/payments/${id}/refund`, { amount, reason }), {
    invalidate: FINANCE_KEYS,
    success: t("Refund recorded."),
  });

  const columns = [
    { key: "createdAt", header: t("Date"), render: (payment) => formatDateTime(payment.paidAt ?? payment.createdAt) },
    { key: "receiptNumber", header: t("Receipt"), render: (payment) => <span className="font-monospace small">{payment.receiptNumber ?? "—"}</span> },
    ...(member ? [] : [{ key: "member", header: t("Member"), render: (payment) => memberLink(payment.member) }]),
    { key: "method", header: t("Method"), render: (payment) => humanize(payment.method), hideBelow: "md" },
    {
      key: "amount",
      header: t("Amount"),
      className: "text-end",
      render: (payment) => (
        <>
          {formatMoney(payment.amount, payment.currency)}
          {payment.refundedAmount > 0 && <div className="small text-muted">{t("refunded {amount}", { amount: formatMoney(payment.refundedAmount, payment.currency) })}</div>}
        </>
      ),
    },
    { key: "status", header: t("Status"), render: (payment) => <StatusBadge status={payment.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">{t("Actions")}</span>,
      className: "text-end",
      render: (payment) =>
        ["succeeded", "partially_refunded"].includes(payment.status) ? (
          <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => setRefunding(payment)} aria-label={t("Refund payment {receipt}", { receipt: payment.receiptNumber })}>
            {t("Refund")}
          </button>
        ) : null,
    },
  ];

  const toolbar = (
    <>
      <div>
        <label htmlFor="payment-status" className="form-label small mb-1">
          {t("Status")}
        </label>
        <select id="payment-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">{t("All")}</option>
          {["succeeded", "pending", "failed", "partially_refunded", "refunded"].map((status) => (
            <option key={status} value={status}>
              {humanize(status)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="payment-method" className="form-label small mb-1">
          {t("Method")}
        </label>
        <select id="payment-method" className="form-select form-select-sm" value={filters.method} onChange={(event) => setFilter("method", event.target.value)}>
          <option value="">{t("All")}</option>
          <option value="cash">{t("Cash")}</option>
          <option value="card">{t("Card")}</option>
        </select>
      </div>
      {extraToolbar}
    </>
  );

  if (!can(PERMISSIONS.PaymentsManage)) return null;
  return (
    <>
      <DataTable columns={columns} query={query} onPageChange={setPage} toolbar={toolbar} caption={t("Payments")} empty={{ icon: "receipt", title: t("No payments match") }} />
      {refunding && (
        <ReasonModal
          title={refunding.receiptNumber ? t("Refund {receipt}", { receipt: refunding.receiptNumber }) : t("Refund payment")}
          confirmLabel={t("Refund")}
          amount={{ label: t("Amount to refund"), max: (refunding.amount - refunding.refundedAmount) / 100, hint: t("Refundable: {amount}", { amount: formatMoney(refunding.amount - refunding.refundedAmount) }) }}
          onClose={() => setRefunding(null)}
          onSubmit={({ amount, reason }) => refund.mutateAsync({ id: refunding._id, amount: toMinorUnits(amount), reason })}
        />
      )}
    </>
  );
}

/** Staff finance: fines (add, waive) and payments (record cash, refund). */
export default function FinesPage() {
  const { can } = usePermissions();
  const canPayments = can(PERMISSIONS.PaymentsManage);
  const [tab, setTab] = useState("fines");
  const [modal, setModal] = useState(null);

  return (
    <>
      <PageHeader
        title={t("Fines & payments")}
        description={t("Amounts are charged and paid in the library currency.")}
        actions={
          <>
            {can(PERMISSIONS.FinesManage) && (
              <button type="button" className="btn btn-outline-primary" onClick={() => setModal("fine")}>
                {t("Add fine")}
              </button>
            )}
            {canPayments && (
              <button type="button" className="btn btn-primary" onClick={() => setModal("payment")}>
                <i className="bi bi-cash me-1" aria-hidden="true"></i>{t("Record payment")}
              </button>
            )}
          </>
        }
      />
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item" role="presentation">
          <button type="button" role="tab" aria-selected={tab === "fines"} className={`nav-link ${tab === "fines" ? "active" : ""}`} onClick={() => setTab("fines")}>
            {t("Fines")}
          </button>
        </li>
        {canPayments && (
          <li className="nav-item" role="presentation">
            <button type="button" role="tab" aria-selected={tab === "payments"} className={`nav-link ${tab === "payments" ? "active" : ""}`} onClick={() => setTab("payments")}>
              {t("Payments")}
            </button>
          </li>
        )}
      </ul>
      {tab === "fines" ? <FinesTable /> : <PaymentsTable />}
      {modal === "fine" && <ManualFineModal onClose={() => setModal(null)} />}
      {modal === "payment" && <CashPaymentModal onClose={() => setModal(null)} />}
    </>
  );
}
