import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBook, deleteBook, getBook, listBooks, updateBook } from "./book.service.js";

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
