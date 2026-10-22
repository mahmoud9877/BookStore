import React from "react";
import { t } from "../../i18n/index.js";

/** Shown while a lazily loaded page's code downloads. */
export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
      <span className="visually-hidden">{t("Loading page")}</span>
    </div>
  );
}
