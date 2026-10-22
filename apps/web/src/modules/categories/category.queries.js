import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookKeys } from "../books/book.queries.js";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./category.service.js";

export const categoryKeys = { all: ["categories"] };

const NO_CATEGORIES = [];

export function useCategoriesQuery() {
  const query = useQuery({ queryKey: categoryKeys.all, queryFn: listCategories });
  return { ...query, data: query.data ?? NO_CATEGORIES };
}

/** Creates a category, or renames one when `categoryId` is given. */
export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, name }) => (categoryId ? updateCategory(categoryId, name) : createCategory(name)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
        // Books show their category's name.
        queryClient.invalidateQueries({ queryKey: bookKeys.all }),
      ]),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
