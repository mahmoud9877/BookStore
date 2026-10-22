import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../../components/ui/Brand.jsx";
import { sectionLink } from "./scroll.js";
import { selectUser, useAuthStore } from "../auth/auth.store.js";
import { useAdminSections } from "../admin/useAdminSections.js";
import LanguageSwitch from "../../components/ui/LanguageSwitch.jsx";
import { msg, t } from "../../i18n/index.js";

export const SECTIONS = [
  { id: "features", label: msg("Features") },
  { id: "modules", label: msg("How it works") },
  { id: "benefits", label: msg("Benefits") },
  { id: "audience", label: msg("Who it's for") },
  { id: "about", label: msg("About") },
];

/** Landing page header: section links, sign in and the primary call to action. */
export default function MarketingHeader() {
  const user = useAuthStore(selectUser);
  const isStaff = useAdminSections().length > 0;
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setIsOpen(false);
  const workspace = isStaff ? { to: "/dashboard", label: t("Open workspace") } : { to: "/account", label: t("My library") };

  return (
    <header className={`marketing-header ${isScrolled ? "is-scrolled" : ""}`}>
      <nav className="container marketing-nav" aria-label={t("Main")}>
        <Brand to="/" />
        <button
          type="button"
          className="btn btn-ghost marketing-toggle"
          aria-controls="marketing-menu"
          aria-expanded={isOpen}
          aria-label={isOpen ? t("Close menu") : t("Open menu")}
          onClick={() => setIsOpen((open) => !open)}
        >
          <i className={`bi bi-${isOpen ? "x-lg" : "list"} fs-4`} aria-hidden="true"></i>
        </button>
        <div id="marketing-menu" className={`marketing-menu ${isOpen ? "is-open" : ""}`}>
          <ul className="marketing-links">
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a {...sectionLink(id, close)}>{t(label)}</a>
              </li>
            ))}
            <li>
              <Link to="/catalog" onClick={close}>
                {t("Catalogue")}
              </Link>
            </li>
          </ul>
          <div className="marketing-actions">
            <LanguageSwitch />
            {user ? (
              <Link to={workspace.to} className="btn btn-primary" onClick={close}>
                {workspace.label}
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost" onClick={close}>
                  {t("Sign in")}
                </Link>
                <Link to="/signup" className="btn btn-primary" onClick={close}>
                  {t("Get started")}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
