import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import useSignOut from "../../auth/hooks/useSignOut.js";
import { useCartCount } from "../../cart/queries/cart.queries.js";
import { initials, pluralize } from "../../../lib/format.js";
import { selectUser, useAuthStore } from "../../auth/stores/auth.store.js";
import { useCurrentUserQuery } from "../../auth/queries/auth.queries.js";
import { useAdminSections } from "../../admin/hooks/useAdminSections.js";
import { msg, t } from "../../../i18n/index.js";

// The built-in roles get friendlier names; custom roles show as named.
const ROLE_LABELS = { Admin: msg("Administrator"), User: msg("Customer") };

function ProfileLink({ to, icon, title, detail }) {
  return (
    <Link to={to} className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-3">
      <i className={`bi bi-${icon} fs-5 text-primary`} aria-hidden="true"></i>
      <span className="flex-grow-1">
        <span className="d-block fw-semibold text-body">{title}</span>
        <span className="small text-muted">{detail}</span>
      </span>
      <i className="bi bi-chevron-right text-muted" aria-hidden="true"></i>
    </Link>
  );
}

export default function ProfilePage() {
  const user = useAuthStore(selectUser);
  // The token's role can be out of date after an admin changes it.
  const role = useCurrentUserQuery().data?.role ?? user.role;
  const canAdminister = useAdminSections().length > 0;
  const count = useCartCount();
  const signOut = useSignOut();

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Helmet>
        <title>{t("Your account · BookSaw")}</title>
      </Helmet>
      <header className="page-header">
        <h1>{t("Your account")}</h1>
      </header>

      <div className="card mb-3">
        <div className="card-body d-flex align-items-center gap-3 p-4">
          <span className="avatar avatar-lg" aria-hidden="true">
            {initials(user.userName)}
          </span>
          <div>
            <h2 className="h4 mb-1">{user.userName}</h2>
            <span className="badge badge-soft">{ROLE_LABELS[role] ? t(ROLE_LABELS[role]) : role}</span>
          </div>
        </div>
      </div>

      <div className="list-group mb-3">
        <ProfileLink
          to="/cart"
          icon="bag"
          title={t("Your cart")}
          detail={count ? t("{books} waiting for checkout", { books: pluralize(count, "book") }) : t("Your cart is empty")}
        />
        <ProfileLink to="/account" icon="person-vcard" title={t("My library")} detail={t("Loans, reservations, fines and notifications")} />
        <ProfileLink to="/catalog" icon="book" title={t("Browse books")} detail={t("Discover your next read")} />
        {canAdminister && (
          <ProfileLink to="/dashboard" icon="speedometer2" title={t("Dashboard")} detail={t("Run the library: circulation, catalogue, members and more")} />
        )}
      </div>

      <button type="button" className="btn btn-outline-primary" onClick={signOut}>
        <i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>{t("Sign out")}
      </button>
    </div>
  );
}
