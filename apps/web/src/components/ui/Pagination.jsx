import React from "react";
import { t } from "../../i18n/index.js";

/** Previous/next pager for `{ page, pages, total }` collection metadata. */
export default function Pagination({ meta, onPageChange, label = t("Pages") }) {
  if (!meta || meta.pages <= 1) return null;
  const { page, pages, total } = meta;
  return (
    <nav className="d-flex align-items-center justify-content-between gap-2 p-3 border-top" aria-label={label}>
      <span className="small text-muted">
        {t("Page {page} of {pages} · {total} total", { page, pages, total })}
      </span>
      <div className="btn-group">
        <button type="button" className="btn btn-sm btn-light" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <i className="bi bi-chevron-left" aria-hidden="true"></i> {t("Previous")}
        </button>
        <button type="button" className="btn btn-sm btn-light" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          {t("Next")} <i className="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </nav>
  );
}
