import React from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

export default function ErrorPage() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="error-container text-center py-5">
      <h1 className="display-4">
        {isNotFound ? "Page not found." : "Oops! Something went wrong."}
      </h1>
      <p className="lead">
        The page you're looking for doesn't exist or an error occurred.
      </p>
      <Link to="/" className="btn btn-primary mt-3">
        Go to Homepage
      </Link>
    </div>
  );
}
