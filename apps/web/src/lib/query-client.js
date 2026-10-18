import { QueryClient } from "@tanstack/react-query";

const isClientError = (error) => {
  const status = error?.response?.status;
  return status >= 400 && status < 500;
};

/**
 * Server-state cache. Data is fresh for 30s; failed reads are retried once,
 * except 4xx responses (retrying a "not found" or "forbidden" never helps).
 */
export function createQueryClient({ queries, mutations } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
        ...queries,
      },
      mutations: { retry: false, ...mutations },
    },
  });
}
