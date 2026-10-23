import React, { useId, useMemo, useState } from "react";
import { currentLocale, t, useLanguage } from "../../i18n/index.js";
import { cleanMobileInput, isValidMobile, joinMobile, mobileCountries, mobileExample, splitMobile } from "../../lib/phone.js";

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

/**
 * Mobile number input with a country-code picker, used for every phone number in
 * the app. It reports one value, the full international number ("+201012345678"),
 * through `onChange` as `{ target: { name, value } }`. The number is checked when
 * the user leaves the field (the form checks it again on submit); the code and
 * digits stay left-to-right in Arabic. The box takes digits only (Arabic digits
 * are converted).
 */
export function MobileField({ label, hint, error, name, value = "", onChange, onBlur, className = "mb-3", disabled }) {
  const id = useId();
  const { language } = useLanguage();
  const [initial] = useState(() => splitMobile(value));
  const [country, setCountry] = useState(initial.country);
  const [national, setNational] = useState(initial.national);
  const [blurError, setBlurError] = useState("");
  const countries = useMemo(() => mobileCountries(currentLocale()), [language]); // eslint-disable-line react-hooks/exhaustive-deps -- currentLocale() follows language

  const check = (full) => (full && !isValidMobile(full) ? t("Enter a valid mobile number.") : "");
  function report(nextCountry, nextNational) {
    const full = joinMobile(nextCountry, nextNational);
    if (blurError) setBlurError(check(full));
    onChange?.({ target: { name, value: full } });
  }

  const shownError = error || blurError;
  const shownHint = hint ?? t("Choose the country code, then type the mobile number.");
  const describedBy = [shownHint && `${id}-hint`, shownError && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="form-label">
        {label ?? t("Mobile number")}
      </label>
      <div className="input-group" dir="ltr">
        <select
          className="form-select flex-grow-0"
          style={{ width: "auto", maxWidth: "11rem" }}
          aria-label={t("Country code")}
          value={country}
          disabled={disabled}
          onChange={(event) => {
            setCountry(event.target.value);
            report(event.target.value, national);
          }}
        >
          {countries.map((option) => (
            <option key={option.code} value={option.code}>
              {`+${option.dial} ${option.name}`}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          className={`form-control ${shownError ? "is-invalid" : ""}`}
          placeholder={mobileExample(country)}
          aria-invalid={Boolean(shownError)}
          aria-describedby={describedBy}
          name={name}
          value={national}
          disabled={disabled}
          onChange={(event) => {
            // Digits only; a pasted "+20 10…" also picks its country.
            const cleaned = cleanMobileInput(event.target.value);
            const nextCountry = cleaned.country ?? country;
            setCountry(nextCountry);
            setNational(cleaned.national);
            report(nextCountry, cleaned.national);
          }}
          onBlur={(event) => {
            setBlurError(check(joinMobile(country, national)));
            onBlur?.(event);
          }}
        />
      </div>
      {shownError && (
        <div id={`${id}-error`} className="invalid-feedback d-block">
          {shownError}
        </div>
      )}
      {shownHint && !shownError && (
        <div id={`${id}-hint`} className="form-text">
          {shownHint}
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
