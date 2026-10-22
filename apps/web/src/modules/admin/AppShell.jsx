import React, { Suspense, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import "../../styles/shell.css";
import Brand from "../../components/ui/Brand.jsx";
import UserMenu from "../../layouts/UserMenu.jsx";
import PageLoader from "../../components/ui/PageLoader.jsx";
import OfflineWarning from "../../components/OfflineWarning.jsx";
import NotificationBell from "../account/NotificationBell.jsx";
import useSignOut from "../auth/useSignOut.js";
import { usePermissions } from "../auth/auth.queries.js";
import { selectUser, useAuthStore } from "../auth/auth.store.js";
import { ADMIN_GROUPS, sectionFor } from "./admin-sections.js";
import LanguageSwitch from "../../components/ui/LanguageSwitch.jsx";
import { msg, t } from "../../i18n/index.js";

const groupOf = (path) => ADMIN_GROUPS.find((group) => group.sections.some((section) => section.path === path));

/** Dashboard › Group › Section (› Detail) from the current URL. */
function Breadcrumbs() {
  const { pathname } = useLocation();
  const [, , sectionPath, detail] = pathname.split("/");
  const section = sectionFor(sectionPath);
  const crumbs = [{ label: msg("Overview"), to: "/dashboard" }];
  if (section) {
    crumbs.push({ label: groupOf(section.path).label });
    crumbs.push({ label: section.label, to: detail ? `/dashboard/${section.path}` : undefined });
    if (detail) crumbs.push({ label: msg("Details") });
  }
  return (
    <nav aria-label={t("Breadcrumb")} className="min-w-0">
      <ol className="breadcrumb shell-breadcrumb mb-0">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.label} className={`breadcrumb-item text-truncate ${isLast ? "active" : ""}`} aria-current={isLast ? "page" : undefined}>
              {crumb.to && !isLast ? <Link to={crumb.to}>{t(crumb.label)}</Link> : t(crumb.label)}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Sidebar({ id, onNavigate }) {
  const { can } = usePermissions();
  const groups = ADMIN_GROUPS.map((group) => ({ ...group, sections: group.sections.filter((section) => can(...section.permissions)) })).filter(
    (group) => group.sections.length
  );
  return (
    <aside id={id} className="shell-sidebar" aria-label={t("Workspace")}>
      <div className="shell-sidebar-brand">
        <Brand to="/dashboard" tone="light" caption={msg("Workspace")} onClick={onNavigate} />
      </div>
      <nav className="shell-nav" aria-label={t("Workspace sections")}>
        <NavLink to="/dashboard" end onClick={onNavigate}>
          <i className="bi bi-grid-1x2" aria-hidden="true"></i>
          {t("Overview")}
        </NavLink>
        {groups.map((group) => (
          <div key={group.label} className="shell-nav-group" role="group" aria-labelledby={`nav-group-${group.label}`}>
            <div className="shell-nav-label" id={`nav-group-${group.label}`}>
              {t(group.label)}
            </div>
            {group.sections.map(({ path, label, icon }) => (
              <NavLink key={path} to={path} onClick={onNavigate}>
                <i className={`bi bi-${icon}`} aria-hidden="true"></i>
                {t(label)}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="shell-sidebar-footer">
        <Link to="/catalog" onClick={onNavigate}>
          <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
          {t("Public catalogue")}
        </Link>
      </div>
    </aside>
  );
}

/**
 * The staff workspace at /dashboard: a navy sidebar (an off-canvas panel below
 * 992px), a compact top bar with breadcrumbs and account actions, and the section.
 * Sections only appear for roles with their permissions; the API enforces the same.
 */
export default function AppShell() {
  const user = useAuthStore(selectUser);
  const signOut = useSignOut();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const toggleRef = useRef(null);
  const mainRef = useRef(null);

  // Close the off-canvas menu after navigating and move focus to the content.
  useEffect(() => {
    setIsNavOpen(false);
    mainRef.current?.scrollTo?.(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNavOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setIsNavOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("shell-nav-locked");
    document.querySelector("#workspace-sidebar a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("shell-nav-locked");
    };
  }, [isNavOpen]);

  return (
    <div className={`shell ${isNavOpen ? "shell-nav-open" : ""}`}>
      <Helmet>
        <meta name="robots" content="noindex" />
      </Helmet>
      <a href="#workspace-content" className="skip-link" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>
        {t("Skip to content")}
      </a>
      <Sidebar id="workspace-sidebar" onNavigate={() => setIsNavOpen(false)} />
      <button type="button" className="shell-scrim" aria-label={t("Close menu")} tabIndex={-1} onClick={() => setIsNavOpen(false)} />
      <div className="shell-main">
        <header className="shell-topbar">
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-ghost shell-menu-toggle"
            aria-controls="workspace-sidebar"
            aria-expanded={isNavOpen}
            aria-label={isNavOpen ? t("Close menu") : t("Open menu")}
            onClick={() => setIsNavOpen((open) => !open)}
          >
            <i className={`bi bi-${isNavOpen ? "x-lg" : "list"} fs-5`} aria-hidden="true"></i>
          </button>
          <Breadcrumbs />
          <div className="ms-auto d-flex align-items-center gap-1">
            <LanguageSwitch />
            <NotificationBell />
            <UserMenu
              user={user}
              onSignOut={signOut}
              items={[
                { to: "/account", label: t("My library"), icon: "person-vcard" },
                { to: "/profile", label: t("Profile"), icon: "person" },
                { to: "/catalog", label: t("Public catalogue"), icon: "book" },
              ]}
            />
          </div>
        </header>
        <OfflineWarning />
        <main id="workspace-content" ref={mainRef} tabIndex={-1} className="shell-content">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
