import React from "react";
import { useToastStore } from "./toast.store.js";

const ICONS = { success: "check-circle-fill", error: "exclamation-octagon-fill", info: "info-circle-fill" };

/** Renders toasts from the toast store in an aria-live region. Mount once. */
export default function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
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
  );
}
