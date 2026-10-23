import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import Joi from "joi";
import useForm from "../../../hooks/useForm.js";
import Modal from "../../../components/ui/Modal.jsx";
import ModalFormActions from "../../../components/ui/ModalFormActions.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import { getErrorMessage } from "../../../lib/api-client.js";
import { pluralize } from "../../../lib/format.js";
import { toast } from "../../../components/ui/toast.store.js";
import { confirm } from "../../../components/ui/confirm.store.js";
import { ErrorState } from "../../../components/ui/StatePanel.jsx";
import { useDeleteRole, usePermissionCatalogue, useRolesQuery, useSaveRole } from "../queries/role.queries.js";
import { roleDescription, roleName } from "../constants/role-labels.js";
import { msg, t } from "../../../i18n/index.js";

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

const SCOPE_LABELS = { all: msg("All branches"), assigned: msg("Assigned branches only") };

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
          <span className="form-label d-block">{t("Name")}</span>
          <strong>{roleName(role.name)}</strong> <span className="small text-muted">{t("(can't be changed)")}</span>
        </p>
      ) : (
        <FormField label={t("Name")} autoComplete="off" {...field("name")} />
      )}
      <FormField label={t("Description")} hint={t("Optional. Who is this role for?")} {...field("description")} />
      <fieldset className="mb-3">
        <legend className="form-label">{t("Where it applies")}</legend>
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
              {t(label)}
              <span className="d-block small text-muted">
                {scope === "all" ? t("Branch-specific permissions work at every branch.") : t("Only at the branches assigned to each account (Users page).")}
              </span>
            </label>
          </div>
        ))}
      </fieldset>
      {groupPermissions(catalogue).map((group) => (
        <fieldset key={group.name} className="mb-2">
          <legend className="form-label small text-uppercase text-muted mb-1">{t(group.name)}</legend>
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
                {t(label)}
                <span className="d-block small text-muted">{t(description)}</span>
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
          <h2 className="h5 mb-0">{roleName(role.name)}</h2>
          {role.isSystem && <span className="badge text-bg-light border">{t("Built-in")}</span>}
        </div>
        <p className="small text-muted mb-2">{role.description ? roleDescription(role.description) : t("No description.")}</p>
        <p className="small mb-2">
          {pluralize(role.userCount, "account")} · {t(SCOPE_LABELS[role.branchScope] ?? SCOPE_LABELS.assigned)}
        </p>
        <div className="d-flex flex-wrap gap-1 mb-3">
          {role.permissions.length ? (
            role.permissions.map((key) => (
              <span key={key} className="badge badge-soft">
                {labels[key] ? t(labels[key]) : key}
              </span>
            ))
          ) : (
            <span className="small text-muted">{t("No administration permissions")}</span>
          )}
        </div>
        {!role.isSystem && (
          <div className="mt-auto d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEdit(role)}>
              <i className="bi bi-pencil me-1" aria-hidden="true"></i>{t("Edit")}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost-danger"
              onClick={() => onDelete(role)}
              disabled={role.userCount > 0}
              title={role.userCount > 0 ? t("Reassign its accounts first") : undefined}
              aria-label={t("Delete {name}", { name: roleName(role.name) })}
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
      toast.success(editedRole ? t("Saved the “{name}” role.", { name: roleName(editedRole.name) }) : t("Created the “{name}” role.", { name: role.name }));
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("Couldn't save this role.")));
    }
  }

  async function handleDelete(role) {
    const confirmed = await confirm({
      title: t("Delete this role?"),
      message: t("“{name}” will be removed. This can't be undone.", { name: roleName(role.name) }),
      confirmLabel: t("Delete role"),
    });
    if (!confirmed) return;
    try {
      await removeRole.mutateAsync(role._id);
      toast.success(t("Deleted “{name}”.", { name: roleName(role.name) }));
    } catch (err) {
      toast.error(getErrorMessage(err, t("Couldn't delete this role.")));
    }
  }

  return (
    <div className="container">
      <Helmet>
        <title>{`${t("Roles & permissions")} · BookSaw`}</title>
      </Helmet>
      <header className="page-header d-flex flex-wrap gap-3 align-items-end justify-content-between">
        <div>
          <h1>{t("Roles & permissions")}</h1>
          <p className="text-muted mb-0">{t("Give staff only the access they need. You can't grant permissions you don't have.")}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(NEW_ROLE)}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>{t("New role")}
        </button>
      </header>

      {isLoading ? (
        <p className="text-muted" aria-busy="true">
          {t("Loading roles…")}
        </p>
      ) : error ? (
        <ErrorState message={getErrorMessage(error, t("Failed to fetch roles."))} onRetry={refetch} />
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
          title={editedRole ? t("Edit role") : t("New role")}
          onClose={closeEditor}
          footer={<ModalFormActions formId="role-form" onCancel={closeEditor} isPending={isSaving} submitLabel={editedRole ? t("Save role") : t("Create role")} />}
        >
          <RoleForm role={editedRole} catalogue={catalogue} onSubmit={handleSave} />
        </Modal>
      )}
    </div>
  );
}
