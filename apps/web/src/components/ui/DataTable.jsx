import React from "react";
import Pagination from "./Pagination.jsx";
import StatePanel, { ErrorState } from "./StatePanel.jsx";
import { SkeletonRows } from "./Skeleton.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { t } from "../../i18n/index.js";

/**
 * A data table with loading, error, empty and paginated states.
 * `columns`: [{ key, header, render?(row), className?, hideBelow?: "sm"|"md"|"lg" }].
 * `query`: a React Query result whose data is `{ data, meta }` (or pass `rows`).
 */
export default function DataTable({ columns, query, rows: givenRows, rowKey = (row) => row._id, empty = {}, onPageChange, caption, toolbar }) {
  const rows = givenRows ?? query?.data?.data ?? [];
  const hidden = (column) => (column.hideBelow ? `d-none d-${column.hideBelow}-table-cell` : "");
  let body;
  if (query?.isLoading) {
    body = (
      <div aria-busy="true" aria-label={t("Loading")}>
        <SkeletonRows columns={Math.min(columns.length, 5)} />
      </div>
    );
  } else if (query?.error) {
    body = (
      <div className="p-3">
        <ErrorState message={getErrorMessage(query.error, t("Couldn't load this list."))} onRetry={query.refetch} />
      </div>
    );
  } else if (!rows.length) {
    body = (
      <div className="p-3">
        <StatePanel icon={empty.icon ?? "inbox"} title={empty.title ?? t("Nothing here yet")} message={empty.message} action={empty.action} />
      </div>
    );
  } else {
    body = (
      <div className="table-responsive">
        <table className="table data-table align-middle">
          {caption && <caption className="visually-hidden">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`${column.className ?? ""} ${hidden(column)}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody aria-busy={query?.isFetching ? "true" : undefined}>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={`${column.className ?? ""} ${hidden(column)}`}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="card">
      {toolbar && <div className="p-3 border-bottom d-flex flex-wrap gap-2 align-items-end">{toolbar}</div>}
      {body}
      {onPageChange && <Pagination meta={query?.data?.meta} onPageChange={onPageChange} />}
    </div>
  );
}
