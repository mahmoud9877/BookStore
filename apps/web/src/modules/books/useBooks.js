import { listBooks } from "./book.service.js";
import useAsyncData from "../../hooks/useAsyncData.js";

/** Loads the book catalogue with loading and error state. */
export default function useBooks() {
  const { data: books, ...state } = useAsyncData(listBooks, {
    initialData: [],
    errorMessage: "Failed to fetch books. Please try again later.",
  });
  return { books, ...state };
}
