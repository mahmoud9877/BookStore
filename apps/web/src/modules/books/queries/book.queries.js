import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBook, deleteBook, getBook, listBooks, listEditions, listRelated, searchCatalog, updateBook } from "../services/book.service.js";

export const bookKeys = {
  all: ["books"],
  list: () => [...bookKeys.all, "list"],
  detail: (bookId) => [...bookKeys.all, "detail", bookId],
};

export const useBooksQuery = () => useQuery({ queryKey: bookKeys.list(), queryFn: listBooks });

/** A single book; shows the catalogue's copy (if cached) while the full record loads. */
export function useBookQuery(bookId) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: bookKeys.detail(bookId),
    queryFn: () => getBook(bookId),
    placeholderData: () => queryClient.getQueryData(bookKeys.list())?.find((book) => book._id === bookId),
  });
}

/** Creates a book, or updates one when `bookId` is given. */
export function useSaveBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, formData }) => (bookId ? updateBook(bookId, formData) : createBook(formData)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId) => deleteBook(bookId),
    onSuccess: (_result, bookId) => {
      queryClient.removeQueries({ queryKey: bookKeys.detail(bookId) });
      return queryClient.invalidateQueries({ queryKey: bookKeys.list() });
    },
  });
}

/** One page of the public catalogue search; the previous page stays visible while the next loads. */
export const useCatalogSearch = (params) =>
  useQuery({
    queryKey: [...bookKeys.all, "search", params],
    queryFn: () => searchCatalog(params),
    placeholderData: keepPreviousData,
  });

export const useEditions = (bookId) =>
  useQuery({ queryKey: [...bookKeys.detail(bookId), "editions"], queryFn: () => listEditions(bookId), enabled: Boolean(bookId) });

export const useRelatedBooks = (bookId) =>
  useQuery({ queryKey: [...bookKeys.detail(bookId), "related"], queryFn: () => listRelated(bookId), enabled: Boolean(bookId) });
