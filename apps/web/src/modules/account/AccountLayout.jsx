import React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
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
        <Link to="/" className="btn btn-outline-primary">
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

  return (
    <div className="container">
      <PageHeader title="My library" description={hasMembership ? `Card ${membership.data.memberNumber}` : undefined} />
      <nav className="admin-nav mb-4" aria-label="My library">
        {TABS.filter((tab) => hasMembership || tab.withoutMembership || tab.end).map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className="admin-nav-link">
            <i className={`bi bi-${icon}`} aria-hidden="true"></i>
            {label}
          </NavLink>
        ))}
      </nav>
      {content}
    </div>
  );
}
