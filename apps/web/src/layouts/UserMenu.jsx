import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { initials } from "../lib/format.js";
import { t } from "../i18n/index.js";

/** Closes a popup on outside click or Escape (returning focus to `toggleRef`). */
export function useDismiss(ref, isOpen, close, toggleRef) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = (event) => !ref.current?.contains(event.target) && close();
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      close();
      toggleRef?.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, isOpen, close, toggleRef]);
}

/**
 * Avatar button with an account menu. `items`: [{ to, label, icon }] links, then
 * a Sign out action. `compact` hides the name (narrow top bars).
 */
export default function UserMenu({ user, items, onSignOut, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const close = () => setIsOpen(false);
  useDismiss(menuRef, isOpen, close, toggleRef);

  return (
    <div className="dropdown" ref={menuRef}>
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-ghost user-menu-toggle d-flex align-items-center gap-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t("Account menu for {name}", { name: user.userName })}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.userName)}
        </span>
        {!compact && <span className="d-none d-lg-inline text-truncate user-menu-name">{user.userName}</span>}
        <i className="bi bi-chevron-down small" aria-hidden="true"></i>
      </button>
      {isOpen && (
        <ul className="dropdown-menu dropdown-menu-end show p-2">
          <li className="px-2 py-1 small text-muted">
            {t("Signed in as")} <strong className="text-body">{user.userName}</strong>
          </li>
          <li>
            <hr className="dropdown-divider" />
          </li>
          {items.map(({ to, label, icon }) => (
            <li key={to}>
              <Link className="dropdown-item" to={to} onClick={close}>
                <i className={`bi bi-${icon} me-2`} aria-hidden="true"></i>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <hr className="dropdown-divider" />
          </li>
          <li>
            <button type="button" className="dropdown-item" onClick={onSignOut}>
              <i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>{t("Sign out")}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
