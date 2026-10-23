import React, { useState } from "react";
import { REPORTS } from "../components/report-definitions.jsx";
import { SummaryReport, MembershipsReport, ReportTotals } from "../components/ReportPanels.jsx";
import PageHeader from "../../../components/ui/PageHeader.jsx";
import DataTable from "../../../components/ui/DataTable.jsx";
import Spinner from "../../../components/ui/Spinner.jsx";
import { ErrorState } from "../../../components/ui/StatePanel.jsx";
import { toast } from "../../../components/ui/toast.store.js";
import { apiClient, cleanParams, usePagedQuery } from "../../../lib/resource.js";
import { getErrorMessage } from "../../../lib/api-client.js";
import { usePermissions } from "../../auth/queries/auth.queries.js";
import { PERMISSIONS } from "../../auth/constants/permissions.js";
import { useActiveBranches } from "../../branches/queries/branch.queries.js";
import { t } from "../../../i18n/index.js";

const NO_ROWS = [];

/** Saves a CSV export. The request goes through apiClient so the auth header is sent. */
async function downloadCsv(report, params) {
  const response = await apiClient.get(`/reports/${report.key}`, {
    params: cleanParams({ ...params, page: undefined, limit: undefined, format: "csv" }),
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.key}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Operational reports with date-range and branch filters and CSV export. */
export default function ReportsPage() {
  const { can } = usePermissions();
  const reports = REPORTS.filter((report) => !report.needsAudit || can(PERMISSIONS.AuditRead));
  const [selected, setSelected] = useState("summary");
  const report = reports.find((item) => item.key === selected) ?? reports[0];
  const [filters, setFilters] = useState({ from: "", to: "", branch: "", order: "most" });
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const { data: branches } = useActiveBranches();

  const params = {
    from: report.filters.includes("range") ? filters.from : undefined,
    // A "to" date includes that whole day.
    to: report.filters.includes("range") && filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
    branch: report.filters.includes("branch") ? filters.branch : undefined,
    order: report.filters.includes("order") ? filters.order : undefined,
    ...(report.paged && { page, limit: 20 }),
  };
  const query = usePagedQuery(["reports", report.key], `/reports/${report.key}`, params);

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };
  const choose = (key) => {
    setSelected(key);
    setPage(1);
  };

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadCsv(report, params);
    } catch (error) {
      toast.error(getErrorMessage(error, t("Couldn't export this report.")));
    } finally {
      setDownloading(false);
    }
  }

  const rows = Array.isArray(query.data?.data) ? query.data.data : NO_ROWS;

  return (
    <>
      <PageHeader
        title={t("Reports")}
        description={t("Figures come straight from the library's records. Amounts are in the library currency.")}
        actions={
          report.csv && (
            <button type="button" className="btn btn-outline-primary" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Spinner label={t("Exporting")} /> : <i className="bi bi-download me-1" aria-hidden="true"></i>}
              {t("Download CSV")}
            </button>
          )
        }
      />

      <div className="row g-3">
        <div className="col-lg-3">
          <div className="list-group" role="tablist" aria-label={t("Reports")}>
            {reports.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={item.key === report.key}
                className={`list-group-item list-group-item-action ${item.key === report.key ? "active" : ""}`}
                onClick={() => choose(item.key)}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="col-lg-9" role="tabpanel" aria-label={t(report.label)}>
          <h2 className="h5 mb-1">{t(report.label)}</h2>
          <p className="text-muted small">{t(report.description)}</p>

          <form className="d-flex flex-wrap gap-2 align-items-end mb-3" onSubmit={(event) => event.preventDefault()} aria-label={t("Report filters")}>
            {report.filters.includes("range") && (
              <>
                <div>
                  <label htmlFor="report-from" className="form-label small mb-1">{t("From")}</label>
                  <input id="report-from" type="date" className="form-control form-control-sm" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} />
                </div>
                <div>
                  <label htmlFor="report-to" className="form-label small mb-1">{t("To")}</label>
                  <input id="report-to" type="date" className="form-control form-control-sm" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} />
                </div>
              </>
            )}
            {report.filters.includes("branch") && (
              <div>
                <label htmlFor="report-branch" className="form-label small mb-1">{t("Branch")}</label>
                <select id="report-branch" className="form-select form-select-sm" value={filters.branch} onChange={(event) => setFilter("branch", event.target.value)}>
                  <option value="">{t("All my branches")}</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            )}
            {report.filters.includes("order") && (
              <div>
                <label htmlFor="report-order" className="form-label small mb-1">{t("Order")}</label>
                <select id="report-order" className="form-select form-select-sm" value={filters.order} onChange={(event) => setFilter("order", event.target.value)}>
                  <option value="most">{t("Most borrowed")}</option>
                  <option value="least">{t("Least borrowed")}</option>
                </select>
              </div>
            )}
          </form>

          {report.columns ? (
            <>
              <ReportTotals reportKey={report.key} body={query.data} />
              <DataTable
                caption={t(report.label)}
                columns={report.columns(rows)}
                query={query}
                rowKey={(row) => row._id ?? row.loanId ?? row.book?._id ?? row.branch?._id ?? row.supplier?._id ?? row.actor ?? JSON.stringify(row)}
                empty={{ icon: "bar-chart", title: t("No data for these filters"), message: t("Try a wider date range or another branch.") }}
                onPageChange={report.paged ? setPage : undefined}
              />
            </>
          ) : query.isLoading ? (
            <p className="text-muted" aria-busy="true">{t("Loading…")}</p>
          ) : query.error ? (
            <ErrorState message={getErrorMessage(query.error, t("Couldn't load this report."))} onRetry={query.refetch} />
          ) : report.key === "summary" ? (
            <SummaryReport data={query.data?.data} />
          ) : (
            <MembershipsReport data={query.data?.data} />
          )}
        </div>
      </div>
    </>
  );
}
