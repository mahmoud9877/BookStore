import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import useAddToCart from "./useAddToCart.js";
import { pluralize } from "../../lib/format.js";
import BookCard, { BookCardSkeleton } from "./BookCard.jsx";
import { useCatalogSearch } from "./book.queries.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { CATALOG_SORT_OPTIONS, resolveCategory } from "./catalogue.js";
import Pagination from "../../components/ui/Pagination.jsx";
import AssistantPanel from "../assistant/AssistantPanel.jsx";
import { useActiveBranches } from "../branches/branch.queries.js";
import { useCategoriesQuery } from "../categories/category.queries.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import { msg, t } from "../../i18n/index.js";

const GRID = "row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3 g-md-4";
const PAGE_SIZE = 24;
const BOOKS_ERROR = msg("Failed to fetch books. Please try again later.");
const FILTER_KEYS = ["q", "category", "available", "branch", "language", "sort", "page"];

/** Keeps a text input responsive while only committing it after a short pause. */
function useDebouncedCommit(value, commit, delay = 300) {
  const [draft, setDraft] = useState(value);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return undefined;
    const timer = setTimeout(() => commitRef.current(draft), delay);
    return () => clearTimeout(timer);
  }, [draft, value, delay]);
  return [draft, setDraft];
}

export default function HomePage() {
  const { data: allCategories } = useCategoriesQuery();
  const { data: branches } = useActiveBranches();
  const { addToCart, pendingId } = useAddToCart();

  // Filters live in the URL, so results can be shared and survive back/forward.
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]));
  const updateFilter = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.delete("page"); // a new filter starts at page 1
    setParams(next, { replace: true });
  };
  const clearFilters = () => setParams({}, { replace: true });
  const [query, setQuery] = useDebouncedCommit(filters.q, (value) => updateFilter("q", value));

  // Only categories with books are worth filtering by.
  const categories = useMemo(() => allCategories.filter((category) => category.bookCount > 0), [allCategories]);
  const categoryId = resolveCategory(filters.category, allCategories);

  const search = useCatalogSearch({
    q: filters.q || undefined,
    category: categoryId || undefined,
    available: filters.available === "1" ? true : undefined,
    branch: filters.branch || undefined,
    language: filters.language || undefined,
    sort: filters.sort || (filters.q ? "relevance" : "title"),
    page: Number(filters.page) || 1,
    limit: PAGE_SIZE,
  });
  const books = search.data?.data ?? [];
  const meta = search.data?.meta;
  const isFiltered = Boolean(filters.q || filters.category || filters.available || filters.branch || filters.language);

  return (
    <>
      <Helmet>
        <title>{t("Browse books · BookSaw")}</title>
      </Helmet>

      <div className="container pt-4">
        <section className="hero mb-4" aria-labelledby="hero-title">
          <h1 id="hero-title">{t("Find your next great read")}</h1>
          <p className="mb-4">{t("Borrow from any of our branches, reserve what's out, or buy your own copy.")}</p>
          <form role="search" className="search-field" onSubmit={(event) => event.preventDefault()}>
            <i className="bi bi-search" aria-hidden="true"></i>
            <input
              type="search"
              className="form-control"
              placeholder={t("Search by title, author, subject or ISBN")}
              aria-label={t("Search books by title, author, subject or ISBN")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
        </section>

        <AssistantPanel onAddToCart={addToCart} pendingId={pendingId} />

        <div className="chip-row mb-3" role="group" aria-label={t("Filter by category")}>
          {[{ _id: "", name: t("All books") }, ...categories].map((category) => (
            <button
              key={category._id || "all"}
              type="button"
              className="chip"
              aria-pressed={categoryId === category._id}
              onClick={() => updateFilter("category", category._id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between mb-3">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div className="form-check form-switch mb-0">
              <input
                id="available-now"
                className="form-check-input"
                type="checkbox"
                role="switch"
                checked={filters.available === "1"}
                onChange={(event) => updateFilter("available", event.target.checked ? "1" : "")}
              />
              <label className="form-check-label" htmlFor="available-now">
                {t("Available now")}
              </label>
            </div>
            <select
              className="form-select form-select-sm w-auto"
              aria-label={t("Branch")}
              value={filters.branch}
              onChange={(event) => updateFilter("branch", event.target.value)}
            >
              <option value="">{t("All branches")}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <input
              className="form-control form-control-sm w-auto"
              style={{ maxWidth: 140 }}
              placeholder={t("Language")}
              aria-label={t("Language")}
              defaultValue={filters.language}
              onBlur={(event) => updateFilter("language", event.target.value.trim())}
              onKeyDown={(event) => event.key === "Enter" && updateFilter("language", event.currentTarget.value.trim())}
            />
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <label htmlFor="sort" className="small text-muted text-nowrap">
              {t("Sort by")}
            </label>
            <select
              id="sort"
              className="form-select form-select-sm"
              value={filters.sort || (filters.q ? "relevance" : "title")}
              onChange={(event) => updateFilter("sort", event.target.value)}
            >
              {CATALOG_SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {search.isLoading ? (
          <div className={GRID} aria-busy="true" aria-label={t("Loading books")}>
            {Array.from({ length: 8 }, (_, index) => (
              <div className="col" key={index}>
                <BookCardSkeleton />
              </div>
            ))}
          </div>
        ) : search.error ? (
          <ErrorState message={getErrorMessage(search.error, t(BOOKS_ERROR))} onRetry={search.refetch} />
        ) : books.length === 0 ? (
          isFiltered ? (
            <StatePanel
              icon="search"
              title={t("No books match your search")}
              message={t("Try a different title, author, subject or branch.")}
              action={
                <button type="button" className="btn btn-outline-primary" onClick={clearFilters}>
                  {t("Clear filters")}
                </button>
              }
            />
          ) : (
            <StatePanel icon="book" title={t("No books yet")} message={t("New titles are on their way. Check back soon.")} />
          )
        ) : (
          <>
            <h2 className="visually-hidden">{t("Books")}</h2>
            <p className="text-muted small mb-3" aria-live="polite">
              {isFiltered ? t("{books} found", { books: pluralize(meta?.total ?? books.length, "book") }) : pluralize(meta?.total ?? books.length, "book")}
            </p>
            <div className={GRID} aria-busy={search.isFetching ? "true" : undefined}>
              {books.map((book) => (
                <div className="col" key={book._id}>
                  <BookCard book={book} onAddToCart={addToCart} isAdding={pendingId === book._id} />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Pagination meta={meta} onPageChange={(page) => updateFilter("page", String(page))} label={t("Catalogue pages")} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
