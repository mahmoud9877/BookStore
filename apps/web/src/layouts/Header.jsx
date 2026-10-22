import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import UserMenu from "./UserMenu.jsx";
import Brand from "../components/ui/Brand.jsx";
import { useCartCount } from "../modules/cart/cart.queries.js";
import { selectUser, useAuthStore } from "../modules/auth/auth.store.js";
import { useAdminSections } from "../modules/admin/useAdminSections.js";
import useSignOut from "../modules/auth/useSignOut.js";
import NotificationBell from "../modules/account/NotificationBell.jsx";
import LanguageSwitch from "../components/ui/LanguageSwitch.jsx";
import { t, tp } from "../i18n/index.js";

/** Header of the public catalogue and the member portal. */
export default function Header() {
  const user = useAuthStore(selectUser);
  const canAdminister = useAdminSections().length > 0;
  const count = useCartCount();
  const signOut = useSignOut();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setIsMenuOpen(false), [location.pathname]);

  const menuItems = [
    { to: "/account", label: t("My library"), icon: "person-vcard" },
    { to: "/profile", label: t("Profile"), icon: "person" },
    ...(canAdminister ? [{ to: "/dashboard", label: t("Staff workspace"), icon: "grid-1x2" }] : []),
  ];

  return (
    <header className="site-header">
      <nav className="navbar navbar-expand-md" aria-label={t("Main")}>
        <div className="container">
          <Brand to="/" />

          <div className="d-flex align-items-center gap-1 ms-auto order-md-last">
            <LanguageSwitch />
            {user && <NotificationBell />}
            <NavLink to="/cart" className="nav-link icon-link-btn" aria-label={`${t("Cart")}, ${tp("item", count)}`}>
              <i className="bi bi-bag fs-5" aria-hidden="true"></i>
              {count > 0 && (
                <span className="cart-count" aria-hidden="true">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </NavLink>
            {user ? (
              <UserMenu user={user} items={menuItems} onSignOut={signOut} />
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm ms-1 d-none d-md-inline-block">
                {t("Sign in")}
              </Link>
            )}
            <button
              className="navbar-toggler border-0 ms-1"
              type="button"
              aria-controls="main-nav"
              aria-expanded={isMenuOpen}
              aria-label={t("Toggle navigation")}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <i className={`bi bi-${isMenuOpen ? "x-lg" : "list"} fs-4`} aria-hidden="true"></i>
            </button>
          </div>

          <div id="main-nav" className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}>
            <ul className="navbar-nav me-auto ms-md-4 gap-md-1 py-2 py-md-0">
              <li className="nav-item">
                <NavLink to="/catalog" className="nav-link">
                  {t("Catalogue")}
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/digital" className="nav-link">
                  {t("Digital library")}
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/events" className="nav-link">
                  {t("Events")}
                </NavLink>
              </li>
              {user && (
                <li className="nav-item">
                  <NavLink to="/account" className="nav-link">
                    {t("My library")}
                  </NavLink>
                </li>
              )}
              {canAdminister && (
                <li className="nav-item">
                  <NavLink to="/dashboard" className="nav-link">
                    {t("Dashboard")}
                  </NavLink>
                </li>
              )}
              {!user && (
                <>
                  <li className="nav-item d-md-none">
                    <NavLink to="/login" className="nav-link">
                      {t("Sign in")}
                    </NavLink>
                  </li>
                  <li className="nav-item d-md-none">
                    <NavLink to="/signup" className="nav-link">
                      {t("Create account")}
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
