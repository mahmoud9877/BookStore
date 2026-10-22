import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import { confirm } from "../../components/ui/confirm.store.js";
import useListState from "../../hooks/useListState.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { apiClient, useApiMutation, useDataQuery, usePagedQuery } from "../../lib/resource.js";
import { formatDate, formatDateTime, formatTitle, humanize } from "../../lib/format.js";
import { usePermissions } from "../auth/auth.queries.js";
import { PERMISSIONS } from "../auth/permissions.js";
import MemberSummary from "../circulation/MemberSummary.jsx";
import LoanTable from "../circulation/LoanTable.jsx";
import ReasonModal from "../circulation/ReasonModal.jsx";
import PlaceReservationModal from "../circulation/PlaceReservationModal.jsx";
import { FinesTable, PaymentsTable } from "../finance/FinesPage.jsx";
import CashPaymentModal from "../finance/CashPaymentModal.jsx";
import MemberFormModal from "./MemberFormModal.jsx";

const TABS = [
  { key: "loans", label: "Loans" },
  { key: "reservations", label: "Reservations" },
  { key: "fines", label: "Fines & payments" },
  { key: "history", label: "Membership history" },
];

function MemberLoans({ memberId }) {
  const { filters, params, setFilter, setPage } = useListState({ status: "active" });
  const query = usePagedQuery(["loans", "member", memberId], "/loans", { ...params, member: memberId });
  const toolbar = (
    <div>
      <label htmlFor="member-loan-status" className="form-label small mb-1">
        Show
      </label>
      <select id="member-loan-status" className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
        <option value="active">On loan now</option>
        <option value="">Full history</option>
      </select>
    </div>
  );
  return <LoanTable query={query} onPageChange={setPage} showMember={false} toolbar={toolbar} empty={{ icon: "book", title: "Nothing on loan" }} />;
}

function MemberReservations({ memberId }) {
  const { params, setPage } = useListState({});
  const query = usePagedQuery(["reservations", "member", memberId], "/reservations", { ...params, member: memberId });
  const columns = [
    { key: "book", header: "Title", render: (row) => formatTitle(row.book?.bookTitle) },
    { key: "pickupBranch", header: "Pickup", render: (row) => row.pickupBranch?.name },
    { key: "createdAt", header: "Placed", render: (row) => formatDate(row.createdAt) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ];
  return <DataTable columns={columns} query={query} onPageChange={setPage} caption="Reservations" empty={{ icon: "bookmark", title: "No reservations" }} />;
}

function MembershipHistory({ memberId }) {
  const query = useDataQuery(["members", memberId, "history"], `/members/${memberId}/history`);
  const columns = [
    { key: "createdAt", header: "When", render: (row) => formatDateTime(row.createdAt) },
    { key: "type", header: "Event", render: (row) => humanize(row.type) },
    {
      key: "details",
      header: "Details",
      render: (row) => (
        <span className="small text-muted">
          {row.details?.reason || row.details?.membershipType || (row.details?.to && `until ${formatDate(row.details.to)}`) || ""}
        </span>
      ),
    },
  ];
  return <DataTable columns={columns} rows={query.data ?? []} query={query} caption="Membership history" empty={{ icon: "clock-history", title: "No history yet" }} />;
}

/** One member: standing, profile, status actions, loans, reservations, money and history. */
export default function MemberDetailPage() {
  const { memberId } = useParams();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.MembersManage);
  const [tab, setTab] = useState("loans");
  const [modal, setModal] = useState(null); // edit | suspend | reactivate | cancel | payment | reserve
  const member = useDataQuery(["members", memberId], `/members/${memberId}`);
  const action = useApiMutation(({ verb, reason }) => apiClient.post(`/members/${memberId}/${verb}`, reason ? { reason } : {}), {
    invalidate: [["members"]],
    success: (saved, { verb }) => ({ renew: `Membership renewed until ${formatDate(saved.expiresAt)}.`, suspend: "Membership suspended.", reactivate: "Membership reactivated.", cancel: "Membership cancelled." })[verb],
  });

  if (member.isLoading) {
    return (
      <p className="text-muted mt-4" aria-busy="true">
        Loading member…
      </p>
    );
  }
  if (member.error) {
    return (
      <div className="mt-4">
        <ErrorState message={getErrorMessage(member.error, "Couldn't load this member.")} onRetry={member.refetch} />
      </div>
    );
  }
  const data = member.data;

  async function renew() {
    if (await confirm({ title: "Renew this membership?", message: `Extends ${data.name}'s membership by its type's period.`, confirmLabel: "Renew", tone: "primary" })) {
      action.mutate({ verb: "renew" });
    }
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="mt-3">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item">
            <Link to="/dashboard/members">Members</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {data.name}
          </li>
        </ol>
      </nav>
      <PageHeader
        title={data.name}
        description={`${data.memberNumber} · member since ${formatDate(data.joinedAt)}`}
        actions={
          <>
            {can(PERMISSIONS.PaymentsManage) && data.summary?.balance > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => setModal("payment")}>
                Take payment
              </button>
            )}
            {can(PERMISSIONS.ReservationsManage) && (
              <button type="button" className="btn btn-outline-primary" onClick={() => setModal("reserve")}>
                Reserve
              </button>
            )}
            {canManage && (
              <>
                <button type="button" className="btn btn-outline-primary" onClick={() => setModal("edit")}>
                  Edit
                </button>
                {data.status !== "cancelled" && (
                  <button type="button" className="btn btn-outline-primary" onClick={renew}>
                    Renew
                  </button>
                )}
                {data.status === "active" && (
                  <button type="button" className="btn btn-outline-danger" onClick={() => setModal("suspend")}>
                    Suspend
                  </button>
                )}
                {data.status === "suspended" && (
                  <button type="button" className="btn btn-outline-primary" onClick={() => setModal("reactivate")}>
                    Reactivate
                  </button>
                )}
                {data.status !== "cancelled" && (
                  <button type="button" className="btn btn-ghost-danger" onClick={() => setModal("cancel")}>
                    Close membership
                  </button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <MemberSummary member={data} linkToDetail={false} />
        </div>
        <div className="col-lg-5">
          <div className="card card-body h-100 small">
            <dl className="row mb-0">
              <dt className="col-4 text-muted fw-normal">Kind</dt>
              <dd className="col-8">
                {humanize(data.kind)}
                {data.institution && ` · ${data.institution}`}
              </dd>
              <dt className="col-4 text-muted fw-normal">Email</dt>
              <dd className="col-8">{data.email || "—"}</dd>
              <dt className="col-4 text-muted fw-normal">Phone</dt>
              <dd className="col-8">{data.phone || "—"}</dd>
              <dt className="col-4 text-muted fw-normal">Address</dt>
              <dd className="col-8">{data.address || "—"}</dd>
              <dt className="col-4 text-muted fw-normal">Online account</dt>
              <dd className="col-8">{data.user ? "Linked" : "Not linked"}</dd>
              {data.notes && (
                <>
                  <dt className="col-4 text-muted fw-normal">Notes</dt>
                  <dd className="col-8 mb-0">{data.notes}</dd>
                </>
              )}
            </dl>
            {data.status !== "active" && (
              <div className="mt-2">
                <StatusBadge status={data.status} /> <span className="text-muted">{data.statusReason}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3" role="tablist">
        {TABS.map(({ key, label }) => (
          <li className="nav-item" role="presentation" key={key}>
            <button type="button" role="tab" aria-selected={tab === key} className={`nav-link ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      {tab === "loans" && <MemberLoans memberId={memberId} />}
      {tab === "reservations" && <MemberReservations memberId={memberId} />}
      {tab === "fines" && (
        <div className="d-grid gap-3">
          <FinesTable member={memberId} />
          <PaymentsTable member={memberId} />
        </div>
      )}
      {tab === "history" && <MembershipHistory memberId={memberId} />}

      {modal === "edit" && <MemberFormModal member={data} onClose={() => setModal(null)} />}
      {modal === "payment" && <CashPaymentModal member={data} onClose={() => setModal(null)} />}
      {modal === "reserve" && <PlaceReservationModal initialMember={data.memberNumber} onClose={() => setModal(null)} />}
      {modal === "suspend" && (
        <ReasonModal
          title={`Suspend ${data.name}?`}
          confirmLabel="Suspend"
          onClose={() => setModal(null)}
          onSubmit={({ reason }) => action.mutateAsync({ verb: "suspend", reason })}
        />
      )}
      {modal === "reactivate" && (
        <ReasonModal
          title={`Reactivate ${data.name}?`}
          confirmLabel="Reactivate"
          tone="primary"
          required={false}
          onClose={() => setModal(null)}
          onSubmit={({ reason }) => action.mutateAsync({ verb: "reactivate", reason })}
        />
      )}
      {modal === "cancel" && (
        <ReasonModal
          title={`Close ${data.name}'s membership?`}
          confirmLabel="Close membership"
          required={false}
          onClose={() => setModal(null)}
          onSubmit={({ reason }) => action.mutateAsync({ verb: "cancel", reason })}
        />
      )}
    </>
  );
}
