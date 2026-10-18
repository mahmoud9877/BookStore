import React, { createContext, useCallback, useContext, useState } from "react";
import Modal from "./Modal.jsx";

const ConfirmContext = createContext(null);

/**
 * `const confirm = useConfirm(); if (await confirm({ title, message })) ...`
 * Replaces window.confirm with an accessible, on-brand dialog.
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    ({ title, message, confirmLabel = "Confirm", tone = "danger" }) =>
      new Promise((resolve) => setRequest({ title, message, confirmLabel, tone, resolve })),
    []
  );

  const settle = (answer) => {
    request.resolve(answer);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal
          size="sm"
          title={request.title}
          onClose={() => settle(false)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => settle(false)}>
                Cancel
              </button>
              <button type="button" className={`btn btn-${request.tone}`} onClick={() => settle(true)}>
                {request.confirmLabel}
              </button>
            </>
          }
        >
          <p className="mb-0 text-muted">{request.message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
