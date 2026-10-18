import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const ICONS = { success: "check-circle-fill", error: "exclamation-octagon-fill", info: "info-circle-fill" };
const DISMISS_AFTER_MS = 4000;

/** Non-blocking notifications, announced to screen readers via an aria-live region. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (type, message) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-2), { id, type, message }]);
      setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map(({ id, type, message }) => (
          <div key={id} className={`app-toast app-toast-${type}`}>
            <i className={`bi bi-${ICONS[type]}`} aria-hidden="true"></i>
            <span className="flex-grow-1">{message}</span>
            <button
              type="button"
              className="btn-close btn-close-white btn-sm"
              aria-label="Dismiss notification"
              onClick={() => dismiss(id)}
            ></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
