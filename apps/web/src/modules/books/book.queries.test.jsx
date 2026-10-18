import { act, renderHook, waitFor } from "@testing-library/react";
import * as bookApi from "./book.service.js";
import { createQueryWrapper } from "../../test-utils/query-wrapper.jsx";
import { bookKeys, useBookQuery, useDeleteBook, useSaveBook } from "./book.queries.js";

jest.mock("./book.service.js");

const DUNE = { _id: "b1", bookTitle: "dune", price: 320 };

test("a book shows the catalogue's cached copy while its details load", async () => {
  const { queryClient, wrapper } = createQueryWrapper();
  queryClient.setQueryData(bookKeys.list(), [DUNE]);
  bookApi.getBook.mockResolvedValue({ ...DUNE, description: "Desert planet." });

  const { result } = renderHook(() => useBookQuery("b1"), { wrapper });

  expect(result.current.data).toEqual(DUNE);
  expect(result.current.isPlaceholderData).toBe(true);
  await waitFor(() => expect(result.current.data.description).toBe("Desert planet."));
});

test("saving creates or updates, then refreshes the catalogue", async () => {
  const { queryClient, wrapper } = createQueryWrapper();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  bookApi.createBook.mockResolvedValue({});
  bookApi.updateBook.mockResolvedValue({});
  const { result } = renderHook(() => useSaveBook(), { wrapper });
  const formData = new FormData();

  await act(() => result.current.mutateAsync({ formData }));
  await act(() => result.current.mutateAsync({ bookId: "b1", formData }));

  expect(bookApi.createBook).toHaveBeenCalledWith(formData);
  expect(bookApi.updateBook).toHaveBeenCalledWith("b1", formData);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: bookKeys.all });
});

test("deleting forgets the book's details and refreshes the list", async () => {
  const { queryClient, wrapper } = createQueryWrapper();
  queryClient.setQueryData(bookKeys.detail("b1"), DUNE);
  bookApi.deleteBook.mockResolvedValue({});
  const { result } = renderHook(() => useDeleteBook(), { wrapper });

  await act(() => result.current.mutateAsync("b1"));

  expect(bookApi.deleteBook).toHaveBeenCalledWith("b1");
  expect(queryClient.getQueryData(bookKeys.detail("b1"))).toBeUndefined();
});
