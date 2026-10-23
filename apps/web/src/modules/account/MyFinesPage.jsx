import React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { fetchJson } from "../../lib/resource.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { formatDate, formatMoney, humanize } from "../../lib/format.js";
import { accountKeys } from "./account.queries.js";
import { goToCheckout, startFinePayment } from "./account.service.js";
import { t } from "../../i18n/index.js";

/** Fines, the balance, paying online, and the payment history. */
export default function MyFinesPage() {
  const fines = useQuery({ queryKey: accountKeys.fines(), queryFn: async () => (await fetchJson("/fines/me")).data });
  const payments = useQuery({ queryKey: accountKeys.payments(), queryFn: async () => (await fetchJson("/payments/me")).data });
  const pay = useMutation({ mutationFn: startFinePayment, onSuccess: ({ url }) => goToCheckout(url) });
  const currency = fines.data?.currency;
  const balance = fines.data?.balance ?? 0;
  const unavailable = pay.error?.response?.status === 503;

  const fineColumns = [
    { key: "createdAt", header: t("Date"), render: (fine) => formatDate(fine.createdAt) },
    { key: "type", header: t("Reason"), render: (fine) => <>{humanize(fine.type)}{fine.reason && <div className="small text-muted">{fine.reason}</div>}</> },
    { key: "amount", header: t("Amount"), className: "text-end", render: (fine) => formatMoney(fine.amount, fine.currency) },
    { key: "balance", header: t("Still owed"), className: "text-end", render: (fine) => formatMoney(fine.balance, fine.currency) },
    { key: "status", header: t("Status"), hideBelow: "sm", render: (fine) => <StatusBadge status={fine.status} /> },
  ];
  const paymentColumns = [
    { key: "paidAt", header: t("Date"), render: (payment) => formatDate(payment.paidAt ?? payment.createdAt) },
    { key: "method", header: t("Method"), render: (payment) => humanize(payment.method) },
    { key: "receipt", header: t("Receipt"), hideBelow: "sm", render: (payment) => payment.receiptNumber ?? "—" },
    { key: "amount", header: t("Amount"), className: "text-end", render: (payment) => formatMoney(payment.amount, payment.currency) },
    { key: "status", header: t("Status"), render: (payment) => <StatusBadge status={payment.status} /> },
  ];

  return (
    <>
      <div className="card mb-4">
        <div className="card-body d-flex flex-wrap gap-3 align-items-center justify-content-between">
          <div>
            <div className="stat-label">{t("Balance")}</div>
            <div className={`stat-value ${balance ? "text-danger" : ""}`}>{fines.isLoading ? "…" : formatMoney(balance, currency)}</div>
          </div>
          {balance > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => pay.mutate()} disabled={pay.isPending}>
              {pay.isPending ? <Spinner label={t("Opening checkout")} /> : (
                <>
                  <i className="bi bi-credit-card me-2" aria-hidden="true"></i>
                  {t("Pay {amount} online", { amount: formatMoney(balance, currency) })}
                </>
              )}
            </button>
          )}
        </div>
        {pay.error && (
          <div className="alert alert-warning m-3 mt-0" role="alert">
            {unavailable
              ? t("Online payment isn't available right now. You can pay at any branch desk.")
              : getErrorMessage(pay.error, t("Couldn't start the payment. Please try again."))}
          </div>
        )}
      </div>
      <h2 className="h5">{t("Fines")}</h2>
      <DataTable caption={t("Fines")} columns={fineColumns} query={fines} rows={fines.data?.fines ?? []} empty={{ icon: "emoji-smile", title: t("No fines — thank you!") }} />
      <h2 className="h5 mt-4">{t("Payments")}</h2>
      <DataTable caption={t("Payments")} columns={paymentColumns} query={payments} rows={payments.data ?? []} empty={{ icon: "receipt", title: t("No payments yet") }} />
    </>
  );
}
