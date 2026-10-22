import React from "react";
import Modal from "./Modal.jsx";
import { t } from "../../i18n/index.js";
import { useConfirmStore } from "./confirm.store.js";

/** Renders the pending confirm() request. Mount once. */
export default function ConfirmDialog() {
  const request = useConfirmStore((state) => state.request);
  const settle = useConfirmStore((state) => state.settle);
  if (!request) return null;

  return (
    <Modal
      size="sm"
      title={request.title}
      onClose={() => settle(false)}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={() => settle(false)}>
            {t("Cancel")}
          </button>
          <button type="button" className={`btn btn-${request.tone}`} onClick={() => settle(true)}>
            {t(request.confirmLabel)}
          </button>
        </>
      }
    >
      <p className="mb-0 text-muted">{request.message}</p>
    </Modal>
  );
}
