import React from "react";
import { Link } from "react-router-dom";
import Brand from "../components/ui/Brand.jsx";
import { msg, t } from "../i18n/index.js";

const LINKS = [
  { label: msg("Catalogue"), to: "/catalog" },
  { label: msg("Digital library"), to: "/digital" },
  { label: msg("Events"), to: "/events" },
  { label: msg("My library"), to: "/account" },
  { label: msg("About BookSaw"), to: "/" },
];

export default function Footer() {
  return (
    <footer className="site-footer mt-5">
      <div className="container py-4">
        <div className="d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center">
          <div>
            <Brand to="/" />
            <p className="mb-0 mt-2">{t("Borrow, reserve and discover across every branch.")}</p>
          </div>
          <nav aria-label={t("Footer")}>
            <ul className="list-inline mb-0">
              {LINKS.map(({ label, to }) => (
                <li key={label} className="list-inline-item me-3">
                  <Link to={to}>{t(label)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <hr className="my-3" />
        <p className="small mb-0">
          {t("© {year} BookSaw · Storefront design based on a template by", { year: new Date().getFullYear() })}{" "}
          <a href="https://www.templatesjungle.com/" target="_blank" rel="noopener noreferrer">
            TemplatesJungle
          </a>
        </p>
      </div>
    </footer>
  );
}
