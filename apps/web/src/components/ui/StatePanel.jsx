import React from "react";
import { t } from "../../i18n/index.js";

/** Empty, error and informational states share one layout. */
export default function StatePanel({ icon = "inbox", title, message, action, role, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <div className="state-panel" role={role}>
      <i className={`bi bi-${icon} state-icon`} aria-hidden="true"></i>
      <Heading className="h5 mt-3 mb-1">{title}</Heading>
      {message && <p className="text-muted mb-0">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <StatePanel
      icon="exclamation-triangle"
      title={t("Something went wrong")}
      message={message}
      role="alert"
      action={
        onRetry && (
          <button type="button" className="btn btn-outline-primary" onClick={onRetry}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>{t("Try again")}
          </button>
        )
      }
    />
  );
}
