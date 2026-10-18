import { useQuery } from "@tanstack/react-query";
import { listCategoryOptions } from "./category.service.js";

const NO_CATEGORIES = [];

/** Category names the API accepts. They change with a deploy, not at runtime. */
export function useCategoryOptions() {
  const { data } = useQuery({
    queryKey: ["categories", "options"],
    queryFn: listCategoryOptions,
    staleTime: Infinity,
  });
  return data ?? NO_CATEGORIES;
}
