import React from "react";
import PageHeader from "../../components/ui/PageHeader.jsx";
import useListState from "../../hooks/useListState.js";
import { usePagedQuery } from "../../lib/resource.js";
import BranchSelect from "./BranchSelect.jsx";
import LoanTable from "./LoanTable.jsx";
import { pluralize } from "../../lib/format.js";
import { t } from "../../i18n/index.js";

/** All loans of the user's branches: filter, renew, declare lost. */
export default function LoansPage() {
  const { filters, params, setFilter, setPage } = useListState({ status: "active", overdue: false, branch: "" });
  const query = usePagedQuery(["loans", "list"], "/loans", { ...params, overdue: params.overdue || undefined, sort: params.overdue ? "dueAt" : "-checkedOutAt" });

  const toolbar = (
    <>
      <div>
        <label htmlFor="loan-status" className="form-label small mb-1">
          {t("Status")}
        </label>
        <select id="loan-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">{t("All")}</option>
          <option value="active">{t("On loan")}</option>
          <option value="returned">{t("Returned")}</option>
          <option value="lost">{t("Lost")}</option>
        </select>
      </div>
      <BranchSelect id="loan-branch" value={filters.branch} onChange={(value) => setFilter("branch", value)} />
      <div className="form-check mb-1 ms-1">
        <input id="loan-overdue" type="checkbox" className="form-check-input" checked={filters.overdue} onChange={(event) => setFilter("overdue", event.target.checked)} />
        <label htmlFor="loan-overdue" className="form-check-label small">
          {t("Overdue only")}
        </label>
      </div>
    </>
  );

  return (
    <>
      <PageHeader title={t("Loans")} description={query.data ? pluralize(query.data.meta.total, "loan") : t("Loading…")} />
      <LoanTable query={query} onPageChange={setPage} toolbar={toolbar} />
    </>
  );
}
