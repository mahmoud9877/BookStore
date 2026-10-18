import React from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import StatePanel from "./ui/StatePanel.jsx";

/** Route error boundary, also rendered (with `notFound`) for unknown URLs inside the layout. */
export default function ErrorPage({ notFound = false }) {
  const error = useRouteError();
  const isNotFound = notFound || (isRouteErrorResponse(error) && error.status === 404);

  return (
    <section className="container py-5">
      <StatePanel
        headingLevel={1}
        icon={isNotFound ? "signpost-split" : "exclamation-triangle"}
        title={isNotFound ? "Page not found" : "Something went wrong"}
        message={
          isNotFound
            ? "The page you're looking for doesn't exist or has moved."
            : "An unexpected error occurred. Please try again."
        }
        action={
          <Link to="/" className="btn btn-primary">
            Back to the bookstore
          </Link>
        }
      />
    </section>
  );
}
