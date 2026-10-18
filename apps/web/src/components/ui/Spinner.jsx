import React from "react";

/** Inline spinner for buttons; `label` is announced to screen readers. */
export default function Spinner({ label = "Loading" }) {
  return (
    <span className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
