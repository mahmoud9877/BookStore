import { useCallback, useEffect, useState } from "react";
import { listBooks } from "./book.service.js";
import { getErrorMessage } from "../../lib/api-client.js";

/** Loads the book catalogue with loading and error state. */
export default function useBooks() {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setBooks(await listBooks());
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch books. Please try again later."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { books, isLoading, error, reload };
}
