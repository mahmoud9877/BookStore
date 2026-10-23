import React, { useState } from "react";
import Modal from "../../../components/ui/Modal.jsx";
import Spinner from "../../../components/ui/Spinner.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import { t } from "../../../i18n/index.js";

/**
 * Asks for a reason (and optionally an amount) before a sensitive action.
 * `onSubmit({ reason, amount })` may return a promise; the modal closes when it resolves.
 */
export default function ReasonModal({
  title,
  label = t("Reason"),
  confirmLabel = t("Confirm"),
  tone = "danger",
  required = true,
  minLength = 3,
  amount, // { label, max } to also ask for an amount (major units)
  onSubmit,
  onClose,
}) {
  const [reason, setReason] = useState("");
  const [amountValue, setAmountValue] = useState(amount?.defaultValue ?? "");
  const [error, setError] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const errors = {};
    if (required && reason.trim().length < minLength) errors.reason = t("Enter a reason (at least {count} characters).", { count: minLength });
    if (amount) {
      const number = Number(amountValue);
      if (!amountValue || !(number > 0)) errors.amount = t("Enter an amount greater than zero.");
      else if (amount.max != null && number > amount.max) errors.amount = t("At most {max}.", { max: amount.max });
    }
    setError(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await onSubmit({ reason: reason.trim(), amount: amount ? Number(amountValue) : undefined });
      onClose();
    } catch {
      // The mutation already reported the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      size="sm"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </button>
          <button type="submit" form="reason-form" className={`btn btn-${tone}`} disabled={busy}>
            {busy ? <Spinner label={t("Working")} /> : confirmLabel}
          </button>
        </>
      }
    >
      <form id="reason-form" onSubmit={submit} noValidate>
        {amount && (
          <FormField
            label={amount.label}
            type="number"
            min="0"
            step="0.01"
            value={amountValue}
            onChange={(event) => setAmountValue(event.target.value)}
            error={error.amount}
            hint={amount.hint}
          />
        )}
        <FormField
          label={required ? label : t("{label} (optional)", { label })}
          as="textarea"
          rows={3}
          className=""
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={error.reason}
        />
      </form>
    </Modal>
  );
}
