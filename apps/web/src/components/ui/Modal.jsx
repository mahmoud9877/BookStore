import React, { useEffect, useRef } from "react";

/**
 * Accessible modal dialog: focuses its first control, closes on Escape or a
 * backdrop click, and restores focus to the previously focused element.
 */
export default function Modal({ title, onClose, children, footer, size }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const focusable = panelRef.current?.querySelector(
      "input, select, textarea, button:not(.btn-close), [href]"
    );
    (focusable ?? panelRef.current)?.focus();

    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop-custom" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`modal-panel ${size === "sm" ? "modal-panel-sm" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="d-flex align-items-center justify-content-between px-4 pt-4">
          <h2 id="modal-title" className="h5 mb-0">
            {title}
          </h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer && <div className="d-flex justify-content-end gap-2 px-4 pb-4">{footer}</div>}
      </div>
    </div>
  );
}
