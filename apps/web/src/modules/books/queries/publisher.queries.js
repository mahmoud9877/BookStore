import { usePagedQuery } from "../../../lib/resource.js";

const NO_PUBLISHERS = [];

/** Publishers for the book form's select. */
export function usePublisherOptions() {
  const query = usePagedQuery(["publishers", "options"], "/publishers", { limit: 100, sort: "name" });
  return query.data?.data ?? NO_PUBLISHERS;
}
