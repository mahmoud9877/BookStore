import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, getErrorMessage, responseData } from "./api-client.js";
import { toast } from "../components/ui/toast.store.js";
import { t } from "../i18n/index.js";

/** Drops empty values so they never reach the query string. */
export const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));

/** GET → the response body. */
export const fetchJson = (url, params) => responseData(apiClient.get(url, { params: cleanParams(params) }));

/**
 * A page of a library collection endpoint (`{ data, meta }`). The previous page
 * stays visible while the next one loads. Query key: [...key, params].
 */
export function usePagedQuery(key, url, params = {}, options = {}) {
  return useQuery({
    queryKey: [...key, cleanParams(params)],
    queryFn: () => fetchJson(url, params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** A single `{ data }` resource (record, report, settings). */
export function useDataQuery(key, url, params, options = {}) {
  return useQuery({
    queryKey: params ? [...key, cleanParams(params)] : key,
    queryFn: async () => (await fetchJson(url, params)).data,
    ...options,
  });
}

/**
 * A write that invalidates `invalidate` query keys on success and reports the
 * outcome with a toast. `success` is a message or a function of the result.
 * Resolves the response body's `data` (or the body).
 */
export function useApiMutation(request, { invalidate = [], success, failure = t("That didn't work. Please try again.") } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables) => {
      const body = await responseData(request(variables));
      return body?.data ?? body;
    },
    onSuccess: async (result, variables) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      const message = typeof success === "function" ? success(result, variables) : success;
      if (message) toast.success(message);
    },
    onError: (error) => toast.error(getErrorMessage(error, failure)),
  });
}

export { apiClient };
