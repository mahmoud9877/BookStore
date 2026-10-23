import React, { useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { apiClient, useApiMutation } from "../../lib/resource.js";
import { daysUntil, formatDate, formatTitle } from "../../lib/format.js";
import { t, tp } from "../../i18n/index.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { CIRCULATION_KEYS } from "./circulation-keys.js";
import ReasonModal from "./ReasonModal.jsx";

function DueCell({ loan }) {
  if (loan.status !== "active") return <span className="text-muted">{formatDate(loan.returnedAt)}</span>;
  const days = daysUntil(loan.dueAt);
  return (
    <span className={days < 0 ? "text-danger fw-semibold" : ""}>
      {formatDate(loan.dueAt)}
      <span className="d-block small text-muted">{days < 0 ? t("{days} overdue", { days: tp("day", -days) }) : days === 0 ? t("due today") : t("in {days}", { days: tp("day", days) })}</span>
    </span>
  );
}

/** Loans with renew / declare-lost actions. `query` is a usePagedQuery result. */
export default function LoanTable({ query, onPageChange, showMember = true, empty, toolbar }) {
  const { can } = usePermissions();
  const canAct = can(PERMISSIONS.CirculationManage);
  const [losing, setLosing] = useState(null);
  const renew = useApiMutation(({ id }) => apiClient.post(`/loans/${id}/renew`), {
    invalidate: CIRCULATION_KEYS,
    success: (loan) => t("Renewed until {date}.", { date: formatDate(loan.dueAt) }),
    failure: t("Couldn't renew this loan."),
  });
  const lost = useApiMutation(({ id, reason }) => apiClient.post(`/loans/${id}/lost`, { reason }), {
    invalidate: CIRCULATION_KEYS,
    success: t("Declared lost. The replacement fee was charged."),
  });

  async function handleRenew(loan) {
    const ok = await confirm({
      title: t("Renew this loan?"),
      message: t("“{title}” for {name}.", { title: formatTitle(loan.book?.bookTitle), name: loan.member?.name }),
      confirmLabel: t("Renew"),
      tone: "primary",
    });
    if (ok) renew.mutate({ id: loan._id });
  }

  const columns = [
    {
      key: "book",
      header: t("Item"),
      render: (loan) => (
        <div className="min-w-0">
          <div className="fw-semibold text-truncate">{formatTitle(loan.book?.bookTitle)}</div>
          <div className="small text-muted">{loan.copy?.barcode}</div>
        </div>
      ),
    },
    ...(showMember
      ? [
          {
            key: "member",
            header: t("Member"),
            render: (loan) =>
              loan.member ? (
                <Link to={`/dashboard/members/${loan.member._id}`}>{loan.member.name}</Link>
              ) : (
                "—"
              ),
            hideBelow: "md",
          },
        ]
      : []),
    { key: "checkedOutAt", header: t("Borrowed"), render: (loan) => formatDate(loan.checkedOutAt), hideBelow: "lg" },
    { key: "dueAt", header: t("Due / returned"), render: (loan) => <DueCell loan={loan} /> },
    { key: "status", header: t("Status"), render: (loan) => <StatusBadge status={loan.status === "active" && daysUntil(loan.dueAt) < 0 ? "overdue" : loan.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">{t("Actions")}</span>,
      className: "text-end text-nowrap",
      render: (loan) =>
        canAct && loan.status === "active" ? (
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleRenew(loan)} aria-label={t("Renew {title}", { title: formatTitle(loan.book?.bookTitle) })}>
              <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
            </button>
            <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => setLosing(loan)} aria-label={t("Declare {title} lost", { title: formatTitle(loan.book?.bookTitle) })}>
              <i className="bi bi-question-octagon" aria-hidden="true"></i>
            </button>
          </>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable columns={columns} query={query} onPageChange={onPageChange} caption={t("Loans")} toolbar={toolbar} empty={empty ?? { icon: "arrow-left-right", title: t("No loans match") }} />
      {losing && (
        <ReasonModal
          title={t("Declare this item lost?")}
          confirmLabel={t("Declare lost")}
          required={false}
          onClose={() => setLosing(null)}
          onSubmit={({ reason }) => lost.mutateAsync({ id: losing._id, reason })}
        />
      )}
    </>
  );
}
