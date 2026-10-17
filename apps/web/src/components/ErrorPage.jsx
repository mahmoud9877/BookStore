import React from "react";
import { Link } from "react-router-dom";

export default function ErrorElement() {
  return (
    <div className="error-container text-center">
      <h1 className="display-4">Oops! Something went wrong.</h1>
      <p className="lead">
        The page you're looking for doesn't exist or an error occurred.
      </p>
      <Link to="home" className="btn btn-primary mt-3">
        Go to Homepage
      </Link>
    </div>
  );
}
