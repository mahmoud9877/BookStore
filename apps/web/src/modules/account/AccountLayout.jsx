import React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { formatDate } from "../../lib/format.js";
import { selectUser, useAuthStore } from "../auth/auth.store.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { useOwnMembership } from "./account.queries.js";

const TABS = [
  { to: "/account", label: "Overview", icon: "person-vcard", end: true },
  { to: "/account/loans", label: "Loans", icon: "book" },
  { to: "/account/reservations", label: "Reservations", icon: "bookmark-star" },
  { to: "/account/fines", label: "Fines", icon: "cash-coin" },
  { to: "/account/notifications", label: "Notifications", icon: "bell", withoutMembership: true },
  { to: "/account/bookings", label: "Rooms & events", icon: "calendar-event" },
];

/** Explains how to get a library card when the account has none linked. */
function NoMembership() {
  return (
    <StatePanel
      icon="person-vcard"
      title="No library card is linked to this account"
      message="Visit any branch with a photo ID to get a library card. Staff will link it to this account's email, and your loans, reservations and fines will appear here. Your account already works for buying books."
      action={
        <Link to="/catalog" className="btn btn-outline-primary">
          Browse the catalogue
        </Link>
      }
    />
  );
}

/** /account: the member's self-service area. */
export default function AccountLayout() {
  const membership = useOwnMembership();
  const location = useLocation();
  const hasMembership = Boolean(membership.data);
  const allowedWithout = TABS.find((tab) => tab.withoutMembership && location.pathname.startsWith(tab.to));

  let content;
  if (membership.isLoading) {
    content = (
      <p className="text-muted" aria-busy="true">
        Loading your account…
      </p>
    );
  } else if (membership.error) {
    content = <ErrorState message={getErrorMessage(membership.error, "Couldn't load your account.")} onRetry={membership.refetch} />;
  } else if (!hasMembership && !allowedWithout) {
    content = <NoMembership />;
  } else {
    content = <Outlet context={{ membership: membership.data }} />;
  }

  const user = useAuthStore(selectUser);
  const member = membership.data;
  return (
    <>
      <Helmet>
        <title>My library · BookSaw</title>
      </Helmet>
      <section className="portal-hero" aria-labelledby="portal-title">
        <div className="container">
          <div className="portal-hero-inner">
            <div>
              <p className="eyebrow mb-1">My library</p>
              <h1 id="portal-title" className="font-display">
                Hello, {member?.name ?? user?.userName}
              </h1>
            </div>
            {member && (
              <dl className="portal-card" aria-label="Library card">
                <div>
                  <dt>Card</dt>
                  <dd className="tabular">{member.memberNumber}</dd>
                </div>
                <div>
                  <dt>Membership</dt>
                  <dd>{member.membershipType?.name}</dd>
                </div>
                <div>
                  <dt>Home branch</dt>
                  <dd>{member.homeBranch?.name}</dd>
                </div>
                <div>
                  <dt>Valid until</dt>
                  <dd>{formatDate(member.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={member.isExpired ? "expired" : member.status} />
                  </dd>
                </div>
              </dl>
            )}
          </div>
          <nav className="admin-nav portal-tabs" aria-label="My library">
            {TABS.filter((tab) => hasMembership || tab.withoutMembership || tab.end).map(({ to, label, icon, end }) => (
              <NavLink key={to} to={to} end={end} className="admin-nav-link">
                <i className={`bi bi-${icon}`} aria-hidden="true"></i>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </section>
      <div className="container pt-4">{content}</div>
    </>
  );
}
