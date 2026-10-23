import React from "react";
import { Link } from "react-router-dom";
import DataTable from "../../../components/ui/DataTable.jsx";
import StatusBadge from "../../../components/ui/StatusBadge.jsx";
import useListState from "../../../hooks/useListState.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../../lib/resource.js";
import { daysUntil, formatDate, formatMoney, formatTitle } from "../../../lib/format.js";
import { accountKeys } from "../queries/account.queries.js";
import { msg, t } from "../../../i18n/index.js";

const FILTERS = [
  { value: "active", label: msg("Current") },
  { value: "returned", label: msg("Returned") },
  { value: "", label: msg("All") },
];

/** The member's loans: current ones (with renewal) and the borrowing history. */
export default function MyLoansPage() {
  const { filters, params, setFilter, setPage } = useListState({ status: "active" });
  const loans = usePagedQuery(accountKeys.loans(), "/loans/me", params);
  const renew = useApiMutation((loan) => apiClient.post(`/loans/me/${loan._id}/renew`), {
    invalidate: [accountKeys.all],
    success: (loan) => t("Renewed. Now due {date}.", { date: formatDate(loan.dueAt) }),
    failure: t("This loan can't be renewed."),
  });

  const columns = [
    {
      key: "title",
      header: t("Title"),
      render: (loan) => (
        <>
          <Link to={`/book/${loan.book?._id}`} className="fw-semibold">
            {formatTitle(loan.book?.bookTitle)}
          </Link>
          <div className="small text-muted">
            {t("Copy {barcode}", { barcode: loan.copy?.barcode })} · {loan.branch?.name}
          </div>
        </>
      ),
    },
    { key: "checkedOutAt", header: t("Borrowed"), hideBelow: "md", render: (loan) => formatDate(loan.checkedOutAt) },
    {
      key: "dueAt",
      header: t("Due"),
      render: (loan) => {
        if (loan.status !== "active") return <span className="text-muted">{t("Returned {date}", { date: formatDate(loan.returnedAt) })}</span>;
        const days = daysUntil(loan.dueAt);
        return (
          <>
            <span className={days < 0 ? "text-danger fw-semibold" : days <= 3 ? "text-warning-emphasis" : ""}>{formatDate(loan.dueAt)}</span>
            {days < 0 && <div className="small text-danger">
                {t("Overdue")}
                {loan.accruedFine ? ` · ${t("{amount} so far", { amount: formatMoney(loan.accruedFine) })}` : ""}
              </div>}
          </>
        );
      },
    },
    { key: "status", header: t("Status"), hideBelow: "sm", render: (loan) => <StatusBadge status={loan.status === "active" && daysUntil(loan.dueAt) < 0 ? "overdue" : loan.status} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">{t("Actions")}</span>,
      className: "text-end",
      render: (loan) =>
        loan.status === "active" && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary text-nowrap"
            disabled={renew.isPending || loan.renewalsLeft === 0 || daysUntil(loan.dueAt) < 0}
            title={loan.renewalsLeft === 0 ? t("No renewals left") : daysUntil(loan.dueAt) < 0 ? t("Overdue loans can't be renewed") : undefined}
            aria-label={t("Renew {title}", { title: formatTitle(loan.book?.bookTitle) })}
            onClick={() => renew.mutate(loan)}
          >
            {loan.renewalsLeft != null ? t("Renew ({count} left)", { count: loan.renewalsLeft }) : t("Renew")}
          </button>
        ),
    },
  ];

  return (
    <DataTable
      caption={t("My loans")}
      columns={columns}
      query={loans}
      onPageChange={setPage}
      empty={{ icon: "book", title: filters.status === "active" ? t("Nothing on loan right now") : t("No loans yet") }}
      toolbar={
        <div className="btn-group" role="group" aria-label={t("Show loans")}>
          {FILTERS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              className={`btn btn-sm ${filters.status === value ? "btn-primary" : "btn-light"}`}
              aria-pressed={filters.status === value}
              onClick={() => setFilter("status", value)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      }
    />
  );
}
