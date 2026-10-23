import React from "react";
import { Helmet } from "react-helmet-async";

/** Centered card shared by the sign-in and sign-up pages; `error` is a form-level message. */
export default function AuthCard({ title, subtitle, error, children, footer }) {
  return (
    <div className="auth-shell">
      <Helmet>
        <title>{`${title} · BookSaw`}</title>
      </Helmet>
      <div className="auth-card">
        <h1 className="h3 mb-1">{title}</h1>
        {subtitle && <p className="text-muted mb-4">{subtitle}</p>}
        {error && (
          <div className="alert alert-danger small" role="alert">
            {error}
          </div>
        )}
        {children}
        {footer && <p className="text-center text-muted small mt-4 mb-0">{footer}</p>}
      </div>
    </div>
  );
}
