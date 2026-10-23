import React from "react";
import { Helmet } from "react-helmet-async";

/** Page title (document + heading), an optional description and actions on the right. */
export default function PageHeader({ title, description, actions, documentTitle }) {
  return (
    <>
      <Helmet>
        <title>{`${documentTitle ?? title} · BookSaw`}</title>
      </Helmet>
      <header className="page-header d-flex flex-wrap gap-3 align-items-end justify-content-between">
        <div>
          <h1>{title}</h1>
          {description && <p className="text-muted mb-0">{description}</p>}
        </div>
        {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
      </header>
    </>
  );
}
