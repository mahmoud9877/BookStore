import React from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import StatePanel from "./ui/StatePanel.jsx";
import { t } from "../i18n/index.js";

/** Route error boundary, also rendered (with `notFound`) for unknown URLs inside the layout. */
export default function ErrorPage({ notFound = false }) {
  const error = useRouteError();
  const isNotFound = notFound || (isRouteErrorResponse(error) && error.status === 404);

  return (
    <section className="container py-5">
      <StatePanel
        headingLevel={1}
        icon={isNotFound ? "signpost-split" : "exclamation-triangle"}
        title={isNotFound ? t("Page not found") : t("Something went wrong")}
        message={
          isNotFound
            ? t("The page you're looking for doesn't exist or has moved.")
            : t("An unexpected error occurred. Please try again.")
        }
        action={
          <Link to="/" className="btn btn-primary">
            {t("Back to the home page")}
          </Link>
        }
      />
    </section>
  );
}
