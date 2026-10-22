import { useState } from "react";

/**
 * Filter/page state for a list screen. Changing a filter returns to page 1.
 * `const { params, setFilter, setPage } = useListState({ status: "" })`
 */
export default function useListState(initialFilters = {}, { limit = 20 } = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };
  return { filters, params: { ...filters, page, limit }, setFilter, setPage, page };
}
