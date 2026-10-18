import React, { useMemo } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import useBooks from "./useBooks.js";
import useAddToCart from "./useAddToCart.js";
import { pluralize } from "../../lib/format.js";
import BookCard, { BookCardSkeleton } from "./BookCard.jsx";
import useAsyncData from "../../hooks/useAsyncData.js";
import { SORT_OPTIONS, filterBooks } from "./catalogue.js";
import { listCategoryOptions } from "../categories/category.service.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";

const GRID = "row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3 g-md-4";

export default function HomePage() {
  const { books, isLoading, error, reload } = useBooks();
  const { data: categories } = useAsyncData(listCategoryOptions, { initialData: [] });
  const { addToCart, pendingId } = useAddToCart();

  // Filters live in the URL, so results can be shared and survive back/forward.
  const [params, setParams] = useSearchParams();
  const filters = {
    query: params.get("q") ?? "",
    category: params.get("category") ?? "",
    sort: params.get("sort") ?? "newest",
  };
  const updateFilter = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };
  const clearFilters = () => setParams({}, { replace: true });

  const visibleBooks = useMemo(
    () => filterBooks(books, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [books, filters.query, filters.category, filters.sort]
  );
  const isFiltered = Boolean(filters.query || filters.category);

  return (
    <>
      <Helmet>
        <title>Browse books · BookSaw</title>
      </Helmet>

      <div className="container pt-4">
        <section className="hero mb-4" aria-labelledby="hero-title">
          <h1 id="hero-title">Find your next great read</h1>
          <p className="mb-4">Fiction, science, biographies and more — delivered to your door.</p>
          <form role="search" className="search-field" onSubmit={(event) => event.preventDefault()}>
            <i className="bi bi-search" aria-hidden="true"></i>
            <input
              type="search"
              className="form-control"
              placeholder="Search by title or author"
              aria-label="Search books by title or author"
              value={filters.query}
              onChange={(event) => updateFilter("q", event.target.value)}
            />
          </form>
        </section>

        <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between mb-3">
          <div className="chip-row" role="group" aria-label="Filter by category">
            {["", ...categories].map((category) => (
              <button
                key={category || "all"}
                type="button"
                className="chip"
                aria-pressed={filters.category === category}
                onClick={() => updateFilter("category", category)}
              >
                {category || "All books"}
              </button>
            ))}
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <label htmlFor="sort" className="small text-muted text-nowrap">
              Sort by
            </label>
            <select
              id="sort"
              className="form-select form-select-sm"
              value={filters.sort}
              onChange={(event) => updateFilter("sort", event.target.value === "newest" ? "" : event.target.value)}
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className={GRID} aria-busy="true" aria-label="Loading books">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="col" key={index}>
                <BookCardSkeleton />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : visibleBooks.length === 0 ? (
          isFiltered ? (
            <StatePanel
              icon="search"
              title="No books match your search"
              message="Try a different title, author or category."
              action={
                <button type="button" className="btn btn-outline-primary" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            />
          ) : (
            <StatePanel icon="book" title="No books yet" message="New titles are on their way. Check back soon." />
          )
        ) : (
          <>
            <h2 className="visually-hidden">Books</h2>
            <p className="text-muted small mb-3" aria-live="polite">
              {pluralize(visibleBooks.length, "book")}
              {isFiltered && " found"}
            </p>
            <div className={GRID}>
              {visibleBooks.map((book) => (
                <div className="col" key={book._id}>
                  <BookCard book={book} onAddToCart={addToCart} isAdding={pendingId === book._id} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
