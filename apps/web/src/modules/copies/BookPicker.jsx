import React, { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../lib/resource.js";
import { formatName, formatTitle } from "../../lib/format.js";
import { t } from "../../i18n/index.js";

/**
 * Finds a catalogue record by title, author or ISBN (GET /catalog/search) and
 * reports the chosen book. `value` is the chosen book object or null.
 */
export default function BookPicker({ value, onChange, label = t("Book"), error }) {
  const id = useId();
  const [term, setTerm] = useState("");
  const query = useQuery({
    queryKey: ["catalog", "picker", term],
    queryFn: () => fetchJson("/catalog/search", { q: term, limit: 8, sort: "relevance" }),
    enabled: term.trim().length >= 2,
  });
  const results = query.data?.data ?? [];

  if (value) {
    return (
      <div className="mb-3">
        <span className="form-label d-block">{label}</span>
        <div className="d-flex align-items-center gap-2">
          <strong>{formatTitle(value.bookTitle)}</strong>
          <span className="text-muted small">{formatName(value.author ?? "")}</span>
          <button type="button" className="btn btn-sm btn-link" onClick={() => onChange(null)}>
            {t("Change")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input
        id={id}
        type="search"
        className={`form-control ${error ? "is-invalid" : ""}`}
        placeholder={t("Search by title, author or ISBN")}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <div id={`${id}-error`} className="invalid-feedback">
          {error}
        </div>
      )}
      {term.trim().length >= 2 && (
        <ul className="list-group mt-1" aria-label={t("Matching books")}>
          {query.isLoading && <li className="list-group-item text-muted small">{t("Searching…")}</li>}
          {!query.isLoading && !results.length && <li className="list-group-item text-muted small">{t("No matching books")}</li>}
          {results.map((book) => (
            <li key={book._id} className="list-group-item p-0">
              <button type="button" className="btn btn-link text-start w-100 text-decoration-none" onClick={() => onChange(book)}>
                {formatTitle(book.bookTitle)} <span className="text-muted small">— {formatName(book.author ?? "")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
