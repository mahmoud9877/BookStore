import React, { useState } from "react";
import { PERMISSIONS } from "../auth/permissions.js";
import { usePermissions } from "../auth/auth.queries.js";
import { useAuthStore } from "../auth/auth.store.js";
import { useRolesQuery } from "../roles/role.queries.js";
import { useActiveBranches } from "../branches/branch.queries.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { initials, pluralize } from "../../lib/format.js";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import { useChangeUserRole, useUpdateUserAccess, useUsersQuery } from "./user.queries.js";

const NO_ROLES = [];
const selectUserId = (state) => state.user?.id;

function RoleSelect({ user, roles, onChange, disabled }) {
  // An account may still hold a role that has since been deleted.
  const names = roles.map((role) => role.name);
  if (!names.includes(user.role)) names.push(user.role);
  return (
    <select
      className="form-select form-select-sm"
      style={{ maxWidth: 220 }}
      aria-label={`Role of ${user.userName}`}
      value={user.role}
      disabled={disabled}
      onChange={(event) => onChange(user, event.target.value)}
    >
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

function BranchesForm({ user, branches, onSubmit }) {
  const [selected, setSelected] = useState(() => (user.branches ?? []).map(String));
  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  return (
    <form id="branches-form" onSubmit={(event) => { event.preventDefault(); onSubmit(selected); }}>
      <fieldset>
        <legend className="form-label">Branches</legend>
        <p className="small text-muted">A role limited to assigned branches only works in these.</p>
        {branches.map((branch) => (
          <div className="form-check" key={branch._id}>
            <input id={`branch-${branch._id}`} type="checkbox" className="form-check-input" checked={selected.includes(branch._id)} onChange={() => toggle(branch._id)} />
            <label htmlFor={`branch-${branch._id}`} className="form-check-label">{branch.name} <span className="text-muted small">({branch.code})</span></label>
          </div>
        ))}
      </fieldset>
    </form>
  );
}

/** Admin page: accounts, their role, branches and whether they may sign in. */
export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useUsersQuery({ search, page, limit: 25 });
  const users = data?.users ?? [];
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.UsersManage);
  const { data: roles = NO_ROLES } = useRolesQuery({ enabled: canManage });
  const { data: branches } = useActiveBranches();
  const branchName = Object.fromEntries(branches.map((branch) => [branch._id, branch.code]));
  const changeRole = useChangeUserRole();
  const updateAccess = useUpdateUserAccess();
  const currentUserId = useAuthStore(selectUserId);
  const [editingBranches, setEditingBranches] = useState(null);

  async function handleRoleChange(user, role) {
    try {
      await changeRole.mutateAsync({ userId: user._id, role });
      toast.success(`${user.userName} is now ${role}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't change this role."));
    }
  }

  async function handleBranches(selected) {
    try {
      await updateAccess.mutateAsync({ userId: editingBranches._id, access: { branches: selected } });
      toast.success(`Updated ${editingBranches.userName}'s branches.`);
      setEditingBranches(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the branches."));
    }
  }

  async function handleActive(user) {
    const deactivate = user.isActive !== false;
    const ok = await confirm({
      title: deactivate ? `Deactivate ${user.userName}?` : `Reactivate ${user.userName}?`,
      message: deactivate ? "They are signed out everywhere and can't sign in until reactivated." : "They will be able to sign in again.",
      confirmLabel: deactivate ? "Deactivate" : "Reactivate",
      tone: deactivate ? "danger" : "primary",
    });
    if (!ok) return;
    try {
      await updateAccess.mutateAsync({ userId: user._id, access: { isActive: !deactivate } });
      toast.success(deactivate ? `${user.userName} was deactivated.` : `${user.userName} can sign in again.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't change this account."));
    }
  }

  return (
    <>
      <PageHeader title="Users" description={isLoading ? "Loading…" : pluralize(data?.meta?.total ?? 0, "account")} />

      <div className="card">
        <div className="p-3 border-bottom">
          <input
            type="search"
            className="form-control"
            style={{ maxWidth: 360 }}
            placeholder="Search by name or email"
            aria-label="Search users"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {isLoading ? (
          <p className="text-muted p-4 mb-0" aria-busy="true">
            Loading accounts…
          </p>
        ) : error ? (
          <div className="p-3">
            <ErrorState message={getErrorMessage(error, "Failed to fetch users.")} onRetry={refetch} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-3">
            <StatePanel icon="search" title="No accounts match your search" />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table data-table align-middle">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Role</th>
                  <th scope="col" className="d-none d-md-table-cell">Branches</th>
                  <th scope="col" className="d-none d-md-table-cell">Status</th>
                  <th scope="col" className="text-end"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user._id === currentUserId;
                  const active = user.isActive !== false;
                  return (
                    <tr key={user._id}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <span className="avatar" aria-hidden="true">{initials(user.userName)}</span>
                          <div className="min-w-0">
                            <div className="fw-semibold text-truncate">
                              {user.userName}
                              {isSelf && <span className="text-muted fw-normal"> (you)</span>}
                            </div>
                            <div className="small text-muted text-truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {canManage && !isSelf ? (
                          <RoleSelect user={user} roles={roles} onChange={handleRoleChange} disabled={changeRole.isPending} />
                        ) : (
                          <span className="badge badge-soft">{user.role}</span>
                        )}
                      </td>
                      <td className="d-none d-md-table-cell small">
                        {(user.branches ?? []).length ? user.branches.map((id) => branchName[id] ?? "?").join(", ") : <span className="text-muted">None</span>}
                      </td>
                      <td className="d-none d-md-table-cell">
                        <StatusBadge status={active ? "active" : "suspended"} label={active ? "Active" : "Deactivated"} />
                        {!user.confirmEmail && <div className="small text-muted">Email not confirmed</div>}
                      </td>
                      <td className="text-end text-nowrap">
                        {canManage && !isSelf && (
                          <>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingBranches(user)} aria-label={`Branches of ${user.userName}`}>
                              <i className="bi bi-building" aria-hidden="true"></i>
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${active ? "btn-ghost-danger" : "btn-ghost"}`}
                              onClick={() => handleActive(user)}
                              aria-label={`${active ? "Deactivate" : "Reactivate"} ${user.userName}`}
                            >
                              <i className={`bi bi-${active ? "person-slash" : "person-check"}`} aria-hidden="true"></i>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={data?.meta} onPageChange={setPage} label="User pages" />
      </div>

      {editingBranches && (
        <Modal
          title={`Branches for ${editingBranches.userName}`}
          size="sm"
          onClose={() => !updateAccess.isPending && setEditingBranches(null)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setEditingBranches(null)} disabled={updateAccess.isPending}>Cancel</button>
              <button type="submit" form="branches-form" className="btn btn-primary" disabled={updateAccess.isPending}>
                {updateAccess.isPending ? <Spinner label="Saving" /> : "Save branches"}
              </button>
            </>
          }
        >
          <BranchesForm user={editingBranches} branches={branches} onSubmit={handleBranches} />
        </Modal>
      )}
    </>
  );
}
