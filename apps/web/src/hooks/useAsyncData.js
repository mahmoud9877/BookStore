import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../lib/api-client.js";

/**
 * Runs `load` on mount (and whenever `load` changes) and tracks loading and
 * error state. Pass a memoized `load` (useCallback) when it depends on props.
 * Results of superseded calls are ignored.
 */
export default function useAsyncData(load, { initialData = null, errorMessage } = {}) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const latestCall = useRef(0);

  const reload = useCallback(async () => {
    const call = ++latestCall.current;
    const isLatest = () => call === latestCall.current;
    setIsLoading(true);
    try {
      const result = await load();
      if (isLatest()) {
        setData(result);
        setError("");
      }
    } catch (err) {
      if (isLatest()) setError(getErrorMessage(err, errorMessage));
    } finally {
      if (isLatest()) setIsLoading(false);
    }
  }, [load, errorMessage]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, isLoading, error, reload };
}
