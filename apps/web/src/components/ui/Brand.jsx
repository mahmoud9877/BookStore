import React from "react";
import { Link } from "react-router-dom";
import Logo from "../../assets/images/main-logo.png";
import { t } from "../../i18n/index.js";

/**
 * The BookSaw wordmark, linking home. `tone="light"` renders it white for dark
 * surfaces (the workspace sidebar). `caption` adds a small product label.
 */
export default function Brand({ to = "/", tone = "dark", caption, onClick }) {
  return (
    <Link to={to} className={`brand brand-${tone}`} onClick={onClick} aria-label={t("BookSaw home")}>
      <img src={Logo} alt="" className="brand-logo" width="125" height="22" />
      {caption && <span className="brand-caption">{t(caption)}</span>}
    </Link>
  );
}
