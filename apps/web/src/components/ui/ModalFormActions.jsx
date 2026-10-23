import React from "react";
import { t } from "../../i18n/index.js";
import Spinner from "./Spinner.jsx";

export default function ModalFormActions({ formId, onCancel, isPending, submitLabel }) {
  return (
    <>
      <button type="button" className="btn btn-light" onClick={onCancel} disabled={isPending}>
        {t("Cancel")}
      </button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={isPending}>
        {isPending ? <Spinner label={t("Saving")} /> : submitLabel}
      </button>
    </>
  );
}
