import React, { useId, useState } from "react";
import { t } from "../../i18n/index.js";

/**
 * Labelled form control with an inline error. `as` selects the element
 * ("input" | "select" | "textarea"); remaining props go to the control.
 */
export default function FormField({ label, error, hint, as: Control = "input", className = "mb-3", ...props }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const controlClass = Control === "select" ? "form-select" : "form-control";

  return (
    <div className={className}>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <Control
        id={id}
        className={`${controlClass} ${error ? "is-invalid" : ""}`}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && !error && (
        <div id={`${id}-hint`} className="form-text">
          {hint}
        </div>
      )}
      {error && (
        <div id={`${id}-error`} className="invalid-feedback">
          {error}
        </div>
      )}
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField({ label, error, hint, className = "mb-3", ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <div className="password-field">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`form-control ${error ? "is-invalid" : ""}`}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        />
        <button
          type="button"
          className="btn btn-sm btn-ghost password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("Hide {field}", { field: label.toLowerCase() }) : t("Show {field}", { field: label.toLowerCase() })}
          aria-pressed={visible}
        >
          <i className={`bi bi-${visible ? "eye-slash" : "eye"}`} aria-hidden="true"></i>
        </button>
      </div>
      {/* Outside the positioned wrapper so the toggle stays vertically centred on the input. */}
      {error && (
        <div id={`${id}-error`} className="invalid-feedback d-block">
          {error}
        </div>
      )}
      {hint && !error && (
        <div id={`${id}-hint`} className="form-text">
          {hint}
        </div>
      )}
    </div>
  );
}

/** Turns Joi validation details into `{ field: message }` (first message per field). */
export const fieldErrors = (joiError) =>
  (joiError?.details ?? []).reduce((errors, { path, message }) => {
    const field = path[0];
    // Custom schema messages are English keys, translated here.
    if (!errors[field]) errors[field] = t(message.replace(/^"[^"]+" /, "").replace(/^./, (c) => c.toUpperCase()));
    return errors;
  }, {});
