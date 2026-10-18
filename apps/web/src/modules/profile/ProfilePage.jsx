import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import useSignOut from "../auth/useSignOut.js";
import { useCart } from "../cart/CartContext.jsx";
import { initials, pluralize } from "../../lib/format.js";
import { USER_ROLES, useUser } from "../auth/UserContext.jsx";

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
  const { userData } = useUser();
  const { count } = useCart();
  const signOut = useSignOut();
  const isAdmin = userData.role === USER_ROLES.Admin;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Helmet>
        <title>Your account · BookSaw</title>
      </Helmet>
      <header className="page-header">
        <h1>Your account</h1>
      </header>

      <div className="card mb-3">
        <div className="card-body d-flex align-items-center gap-3 p-4">
          <span className="avatar avatar-lg" aria-hidden="true">
            {initials(userData.userName)}
          </span>
          <div>
            <h2 className="h4 mb-1">{userData.userName}</h2>
            <span className="badge badge-soft">{isAdmin ? "Administrator" : "Customer"}</span>
          </div>
        </div>
      </div>

      <div className="list-group mb-3">
        <ProfileLink
          to="/cart"
          icon="bag"
          title="Your cart"
          detail={count ? `${pluralize(count, "book")} waiting for checkout` : "Your cart is empty"}
        />
        <ProfileLink to="/" icon="book" title="Browse books" detail="Discover your next read" />
        {isAdmin && (
          <ProfileLink to="/dashboard" icon="speedometer2" title="Manage catalogue" detail="Add, edit and remove books" />
        )}
      </div>

      <button type="button" className="btn btn-outline-primary" onClick={signOut}>
        <i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Sign out
      </button>
    </div>
  );
}
