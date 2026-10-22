import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Logo from "../assets/images/main-logo.png";
import { initials } from "../lib/format.js";
import { useCartCount } from "../modules/cart/cart.queries.js";
import { selectUser, useAuthStore } from "../modules/auth/auth.store.js";
import { useAdminSections } from "../modules/admin/useAdminSections.js";
import useSignOut from "../modules/auth/useSignOut.js";
import NotificationBell from "../modules/account/NotificationBell.jsx";

/** Closes a popup on outside click or Escape. */
function useDismiss(ref, isOpen, close) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = (event) => !ref.current?.contains(event.target) && close();
    const onKey = (event) => event.key === "Escape" && close();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, isOpen, close]);
}

function UserMenu({ user, canAdminister, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const close = () => setIsOpen(false);
  useDismiss(menuRef, isOpen, close);

  return (
    <div className="dropdown" ref={menuRef}>
      <button
        type="button"
        className="btn btn-ghost d-flex align-items-center gap-2"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${user.userName}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.userName)}
        </span>
        <span className="d-none d-lg-inline">{user.userName}</span>
        <i className="bi bi-chevron-down small" aria-hidden="true"></i>
      </button>
      {isOpen && (
        <ul className="dropdown-menu dropdown-menu-end show p-2">
          <li className="px-2 py-1 small text-muted">
            Signed in as <strong className="text-body">{user.userName}</strong>
          </li>
          <li>
            <hr className="dropdown-divider" />
          </li>
          <li>
            <Link className="dropdown-item" to="/account" onClick={close}>
              <i className="bi bi-person-vcard me-2" aria-hidden="true"></i>My library
            </Link>
          </li>
          <li>
            <Link className="dropdown-item" to="/profile" onClick={close}>
              <i className="bi bi-person me-2" aria-hidden="true"></i>Profile
            </Link>
          </li>
          {canAdminister && (
            <li>
              <Link className="dropdown-item" to="/dashboard" onClick={close}>
                <i className="bi bi-speedometer2 me-2" aria-hidden="true"></i>Dashboard
              </Link>
            </li>
          )}
          <li>
            <button type="button" className="dropdown-item" onClick={onLogout}>
              <i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Sign out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export default function Header() {
  const user = useAuthStore(selectUser);
  const canAdminister = useAdminSections().length > 0;
  const count = useCartCount();
  const signOut = useSignOut();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setIsMenuOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <nav className="navbar navbar-expand-md" aria-label="Main">
        <div className="container">
          <Link to="/" className="navbar-brand d-flex align-items-center">
            <img src={Logo} alt="BookSaw" className="brand-logo" />
          </Link>

          <div className="d-flex align-items-center gap-1 ms-auto order-md-last">
            {user && <NotificationBell />}
            <NavLink
              to="/cart"
              className="nav-link cart-link px-2"
              aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
            >
              <i className="bi bi-bag fs-5" aria-hidden="true"></i>
              {count > 0 && (
                <span className="cart-count" aria-hidden="true">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </NavLink>
            {user ? (
              <UserMenu user={user} canAdminister={canAdminister} onLogout={signOut} />
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm ms-1 d-none d-md-inline-block">
                Sign in
              </Link>
            )}
            <button
              className="navbar-toggler border-0 ms-1"
              type="button"
              aria-controls="main-nav"
              aria-expanded={isMenuOpen}
              aria-label="Toggle navigation"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <i className={`bi bi-${isMenuOpen ? "x-lg" : "list"} fs-4`} aria-hidden="true"></i>
            </button>
          </div>

          <div id="main-nav" className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}>
            <ul className="navbar-nav me-auto ms-md-3 gap-md-1 py-2 py-md-0">
              <li className="nav-item">
                <NavLink to="/" end className="nav-link">
                  Browse books
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/digital" className="nav-link">
                  Digital library
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/events" className="nav-link">
                  Events
                </NavLink>
              </li>
              {user && (
                <li className="nav-item">
                  <NavLink to="/account" className="nav-link">
                    My library
                  </NavLink>
                </li>
              )}
              {canAdminister && (
                <li className="nav-item">
                  <NavLink to="/dashboard" className="nav-link">
                    Dashboard
                  </NavLink>
                </li>
              )}
              {!user && (
                <>
                  <li className="nav-item d-md-none">
                    <NavLink to="/login" className="nav-link">
                      Sign in
                    </NavLink>
                  </li>
                  <li className="nav-item d-md-none">
                    <NavLink to="/signup" className="nav-link">
                      Create account
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}
