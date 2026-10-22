import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import useListState from "../../hooks/useListState.js";
import { usePagedQuery } from "../../lib/resource.js";
import { formatDate, humanize } from "../../lib/format.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS } from "../auth/permissions.js";
import MemberFormModal from "./MemberFormModal.jsx";

const statusOf = (member) => (member.status === "active" && member.isExpired ? "expired" : member.status);

/** Member directory: search, filter, register. */
export default function MembersPage() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);
  const { filters, params, setFilter, setPage } = useListState({ search: "", status: "", expired: "" });
  const query = usePagedQuery(["members", "list"], "/members", params);

  const columns = [
    {
      key: "name",
      header: "Member",
      render: (member) => (
        <>
          <Link to={member._id} className="fw-semibold">
            {member.name}
          </Link>
          <div className="small text-muted">
            {member.memberNumber}
            {member.email && ` · ${member.email}`}
          </div>
        </>
      ),
    },
    { key: "type", header: "Type", render: (member) => `${member.membershipType?.name ?? ""} · ${humanize(member.kind)}`, hideBelow: "md" },
    { key: "homeBranch", header: "Branch", render: (member) => member.homeBranch?.name, hideBelow: "lg" },
    { key: "expiresAt", header: "Expires", render: (member) => formatDate(member.expiresAt), hideBelow: "sm" },
    { key: "status", header: "Status", render: (member) => <StatusBadge status={statusOf(member)} /> },
  ];

  const toolbar = (
    <>
      <div className="flex-grow-1" style={{ maxWidth: 360 }}>
        <label htmlFor="member-search" className="form-label small mb-1">
          Search
        </label>
        <input
          id="member-search"
          type="search"
          className="form-control form-control-sm"
          placeholder="Name, email, phone or member number"
          value={filters.search}
          onChange={(event) => setFilter("search", event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="member-status" className="form-label small mb-1">
          Status
        </label>
        <select id="member-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div>
        <label htmlFor="member-expired" className="form-label small mb-1">
          Membership
        </label>
        <select id="member-expired" className="form-select form-select-sm" value={filters.expired} onChange={(event) => setFilter("expired", event.target.value)}>
          <option value="">Any</option>
          <option value="false">Current</option>
          <option value="true">Expired</option>
        </select>
      </div>
    </>
  );

  return (
    <>
      <PageHeader
        title="Members"
        description={query.data ? `${query.data.meta.total} member(s)` : "Loading…"}
        actions={
          can(PERMISSIONS.MembersManage) && (
            <button type="button" className="btn btn-primary" onClick={() => setRegistering(true)}>
              <i className="bi bi-person-plus me-1" aria-hidden="true"></i>Register member
            </button>
          )
        }
      />
      <DataTable columns={columns} query={query} onPageChange={setPage} toolbar={toolbar} caption="Members" empty={{ icon: "person-vcard", title: "No members match" }} />
      {registering && <MemberFormModal onClose={() => setRegistering(false)} onSaved={(member) => navigate(member._id)} />}
    </>
  );
}
