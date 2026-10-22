import React from "react";
import PageHeader from "../../components/ui/PageHeader.jsx";
import useListState from "../../hooks/useListState.js";
import { usePagedQuery } from "../../lib/resource.js";
import BranchSelect from "./BranchSelect.jsx";
import LoanTable from "./LoanTable.jsx";

/** All loans of the user's branches: filter, renew, declare lost. */
export default function LoansPage() {
  const { filters, params, setFilter, setPage } = useListState({ status: "active", overdue: false, branch: "" });
  const query = usePagedQuery(["loans", "list"], "/loans", { ...params, overdue: params.overdue || undefined, sort: params.overdue ? "dueAt" : "-checkedOutAt" });

  const toolbar = (
    <>
      <div>
        <label htmlFor="loan-status" className="form-label small mb-1">
          Status
        </label>
        <select id="loan-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">All</option>
          <option value="active">On loan</option>
          <option value="returned">Returned</option>
          <option value="lost">Lost</option>
        </select>
      </div>
      <BranchSelect id="loan-branch" value={filters.branch} onChange={(value) => setFilter("branch", value)} />
      <div className="form-check mb-1 ms-1">
        <input id="loan-overdue" type="checkbox" className="form-check-input" checked={filters.overdue} onChange={(event) => setFilter("overdue", event.target.checked)} />
        <label htmlFor="loan-overdue" className="form-check-label small">
          Overdue only
        </label>
      </div>
    </>
  );

  return (
    <>
      <PageHeader title="Loans" description={query.data ? `${query.data.meta.total} loan(s)` : "Loading…"} />
      <LoanTable query={query} onPageChange={setPage} toolbar={toolbar} />
    </>
  );
}
