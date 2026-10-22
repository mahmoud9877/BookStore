import React from "react";
import { t } from "../../i18n/index.js";

/** Inline spinner for buttons; `label` is announced to screen readers. */
export default function Spinner({ label = t("Loading") }) {
  return (
    <span className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
