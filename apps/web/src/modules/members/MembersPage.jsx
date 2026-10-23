import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import useListState from "../../hooks/useListState.js";
import { usePagedQuery } from "../../lib/resource.js";
import { formatDate, humanize, pluralize } from "../../lib/format.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS } from "../auth/permissions.js";
import MemberFormModal from "./MemberFormModal.jsx";
import { t } from "../../i18n/index.js";

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
      header: t("Member"),
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
    { key: "type", header: t("Type"), render: (member) => `${member.membershipType?.name ?? ""} · ${humanize(member.kind)}`, hideBelow: "md" },
    { key: "homeBranch", header: t("Branch"), render: (member) => member.homeBranch?.name, hideBelow: "lg" },
    { key: "expiresAt", header: t("Expires"), render: (member) => formatDate(member.expiresAt), hideBelow: "sm" },
    { key: "status", header: t("Status"), render: (member) => <StatusBadge status={statusOf(member)} /> },
  ];

  const toolbar = (
    <>
      <div className="flex-grow-1" style={{ maxWidth: 360 }}>
        <label htmlFor="member-search" className="form-label small mb-1">
          {t("Search")}
        </label>
        <input
          id="member-search"
          type="search"
          className="form-control form-control-sm"
          placeholder={t("Name, email, phone or member number")}
          value={filters.search}
          onChange={(event) => setFilter("search", event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="member-status" className="form-label small mb-1">
          {t("Status")}
        </label>
        <select id="member-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">{t("All")}</option>
          <option value="active">{t("Active")}</option>
          <option value="suspended">{t("Suspended")}</option>
          <option value="cancelled">{t("Cancelled")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="member-expired" className="form-label small mb-1">
          {t("Membership")}
        </label>
        <select id="member-expired" className="form-select form-select-sm" value={filters.expired} onChange={(event) => setFilter("expired", event.target.value)}>
          <option value="">{t("Any")}</option>
          <option value="false">{t("Current")}</option>
          <option value="true">{t("Expired")}</option>
        </select>
      </div>
    </>
  );

  return (
    <>
      <PageHeader
        title={t("Members")}
        description={query.data ? pluralize(query.data.meta.total, "member") : t("Loading…")}
        actions={
          can(PERMISSIONS.MembersManage) && (
            <button type="button" className="btn btn-primary" onClick={() => setRegistering(true)}>
              <i className="bi bi-person-plus me-1" aria-hidden="true"></i>
              {t("Register member")}
            </button>
          )
        }
      />
      <DataTable columns={columns} query={query} onPageChange={setPage} toolbar={toolbar} caption={t("Members")} empty={{ icon: "person-vcard", title: t("No members match") }} />
      {registering && <MemberFormModal onClose={() => setRegistering(false)} onSaved={(member) => navigate(member._id)} />}
    </>
  );
}
