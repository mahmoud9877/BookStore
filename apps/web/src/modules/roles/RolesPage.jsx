import React, { useState } from "react";
import { Helmet } from "react-helmet";
import Joi from "joi";
import useForm from "../../hooks/useForm.js";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import FormField from "../../components/ui/FormField.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { pluralize } from "../../lib/format.js";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import { useDeleteRole, usePermissionCatalogue, useRolesQuery, useSaveRole } from "./role.queries.js";

const NEW_ROLE = Symbol("new role");
const NO_ROLES = [];
const NO_PERMISSIONS = [];

// Mirrors the API's CreateRoleDto (apps/api/src/modules/roles/role.dto.js).
const roleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(40).required().messages({
    "string.empty": "Enter a role name.",
    "string.min": "Use at least 2 characters.",
  }),
  description: Joi.string().trim().allow("").max(200),
  permissions: Joi.array(),
  branchScope: Joi.string().valid("all", "assigned"),
});

const SCOPE_LABELS = { all: "All branches", assigned: "Assigned branches only" };

/** The catalogue grouped by its `group` field, keeping catalogue order. */
const groupPermissions = (catalogue) =>
  catalogue.reduce((groups, permission) => {
    const group = groups.find((item) => item.name === (permission.group ?? "Other"));
    if (group) group.items.push(permission);
    else groups.push({ name: permission.group ?? "Other", items: [permission] });
    return groups;
  }, []);

function RoleForm({ role, catalogue, onSubmit }) {
  const isEditing = Boolean(role);
  const { values, field, handleSubmit } = useForm(
    { name: role?.name ?? "", description: role?.description ?? "", permissions: role?.permissions ?? [], branchScope: role?.branchScope ?? "assigned" },
    { schema: roleSchema }
  );
  const [permissions, setPermissions] = useState(values.permissions);
  const [branchScope, setBranchScope] = useState(values.branchScope);
  const toggle = (key) =>
    setPermissions((current) => (current.includes(key) ? current.filter((p) => p !== key) : [...current, key]));

  return (
    <form id="role-form" onSubmit={handleSubmit((value) => onSubmit({ ...value, permissions, branchScope }))} noValidate>
      {isEditing ? (
        <p className="mb-3">
          <span className="form-label d-block">Name</span>
          <strong>{role.name}</strong> <span className="small text-muted">(can't be changed)</span>
        </p>
      ) : (
        <FormField label="Name" autoComplete="off" {...field("name")} />
      )}
      <FormField label="Description" hint="Optional. Who is this role for?" {...field("description")} />
      <fieldset className="mb-3">
        <legend className="form-label">Where it applies</legend>
        {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
          <div className="form-check" key={scope}>
            <input
              className="form-check-input"
              type="radio"
              name="branchScope"
              id={`scope-${scope}`}
              checked={branchScope === scope}
              onChange={() => setBranchScope(scope)}
            />
            <label className="form-check-label" htmlFor={`scope-${scope}`}>
              {label}
              <span className="d-block small text-muted">
                {scope === "all" ? "Branch-specific permissions work at every branch." : "Only at the branches assigned to each account (Users page)."}
              </span>
            </label>
          </div>
        ))}
      </fieldset>
      {groupPermissions(catalogue).map((group) => (
        <fieldset key={group.name} className="mb-2">
          <legend className="form-label small text-uppercase text-muted mb-1">{group.name}</legend>
          {group.items.map(({ key, label, description }) => (
            <div className="form-check mb-2" key={key}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`permission-${key}`}
                checked={permissions.includes(key)}
                onChange={() => toggle(key)}
              />
              <label className="form-check-label" htmlFor={`permission-${key}`}>
                {label}
                <span className="d-block small text-muted">{description}</span>
              </label>
            </div>
          ))}
        </fieldset>
      ))}
    </form>
  );
}

function RoleCard({ role, labels, onEdit, onDelete }) {
  return (
    <div className="card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
          <h2 className="h5 mb-0">{role.name}</h2>
          {role.isSystem && <span className="badge text-bg-light border">Built-in</span>}
        </div>
        <p className="small text-muted mb-2">{role.description || "No description."}</p>
        <p className="small mb-2">
          {pluralize(role.userCount, "account")} · {SCOPE_LABELS[role.branchScope] ?? SCOPE_LABELS.assigned}
        </p>
        <div className="d-flex flex-wrap gap-1 mb-3">
          {role.permissions.length ? (
            role.permissions.map((key) => (
              <span key={key} className="badge badge-soft">
                {labels[key] ?? key}
              </span>
            ))
          ) : (
            <span className="small text-muted">No administration permissions</span>
          )}
        </div>
        {!role.isSystem && (
          <div className="mt-auto d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEdit(role)}>
              <i className="bi bi-pencil me-1" aria-hidden="true"></i>Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost-danger"
              onClick={() => onDelete(role)}
              disabled={role.userCount > 0}
              title={role.userCount > 0 ? "Reassign its accounts first" : undefined}
              aria-label={`Delete ${role.name}`}
            >
              <i className="bi bi-trash3" aria-hidden="true"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Admin page: roles and the permissions each grants. */
export default function RolesPage() {
  const { data: roles = NO_ROLES, isLoading, error, refetch } = useRolesQuery();
  const { data: catalogue = NO_PERMISSIONS } = usePermissionCatalogue();
  const saveRole = useSaveRole();
  const removeRole = useDeleteRole();
  const [editing, setEditing] = useState(null); // NEW_ROLE, a role, or null when closed
  const editedRole = editing === NEW_ROLE ? null : editing;
  const isSaving = saveRole.isPending;
  const closeEditor = () => !isSaving && setEditing(null);
  const labels = Object.fromEntries(catalogue.map(({ key, label }) => [key, label]));

  async function handleSave(role) {
    try {
      await saveRole.mutateAsync({ roleId: editedRole?._id, role });
      toast.success(editedRole ? `Saved the “${editedRole.name}” role.` : `Created the “${role.name}” role.`);
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save this role."));
    }
  }

  async function handleDelete(role) {
    const confirmed = await confirm({
      title: "Delete this role?",
      message: `“${role.name}” will be removed. This can't be undone.`,
      confirmLabel: "Delete role",
    });
    if (!confirmed) return;
    try {
      await removeRole.mutateAsync(role._id);
      toast.success(`Deleted “${role.name}”.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete this role."));
    }
  }

  return (
    <div className="container">
      <Helmet>
        <title>Roles & permissions · BookSaw</title>
      </Helmet>
      <header className="page-header d-flex flex-wrap gap-3 align-items-end justify-content-between">
        <div>
          <h1>Roles &amp; permissions</h1>
          <p className="text-muted mb-0">Give staff only the access they need. You can't grant permissions you don't have.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(NEW_ROLE)}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>New role
        </button>
      </header>

      {isLoading ? (
        <p className="text-muted" aria-busy="true">
          Loading roles…
        </p>
      ) : error ? (
        <ErrorState message={getErrorMessage(error, "Failed to fetch roles.")} onRetry={refetch} />
      ) : (
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
          {roles.map((role) => (
            <div className="col" key={role.name}>
              <RoleCard role={role} labels={labels} onEdit={setEditing} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editedRole ? "Edit role" : "New role"}
          onClose={closeEditor}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={closeEditor} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" form="role-form" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? <Spinner label="Saving" /> : editedRole ? "Save role" : "Create role"}
              </button>
            </>
          }
        >
          <RoleForm role={editedRole} catalogue={catalogue} onSubmit={handleSave} />
        </Modal>
      )}
    </div>
  );
}
