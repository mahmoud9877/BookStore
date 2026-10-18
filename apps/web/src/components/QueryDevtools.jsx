import React, { Suspense } from "react";

// Loaded only in development; the production build drops this branch entirely.
const Devtools =
  process.env.NODE_ENV === "development"
    ? React.lazy(() =>
        import("@tanstack/react-query-devtools").then((module) => ({ default: module.ReactQueryDevtools }))
      )
    : null;

/** React Query devtools (development only). */
export default function QueryDevtools() {
  if (!Devtools) return null;
  return (
    <Suspense fallback={null}>
      <Devtools initialIsOpen={false} buttonPosition="bottom-left" />
    </Suspense>
  );
}
