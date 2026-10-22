import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import FormField from "../../components/ui/FormField.jsx";
import useListState from "../../hooks/useListState.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../lib/resource.js";

/**
 * List + create/edit/delete for simple reference data (authors, publishers,
 * suppliers, branches, rooms…) on a library CRUD endpoint (`{ data, meta }`).
 *
 * `fields`: [{ name, label, type?: "text"|"textarea"|"select"|"checkbox"|"number"|"email",
 *             options?: [{ value, label }], required?, hint?, onlyOnCreate? }]
 * `columns`: DataTable columns (an actions column is appended).
 * `toForm(record)` / `fromForm(values)` convert between records and form values.
 */
export default function SimpleCrudSection({
  entity,
  queryKey,
  url,
  fields,
  columns,
  canManage = true,
  searchPlaceholder = "Search",
  filters: extraFilters = {},
  toolbarExtra,
  toForm = (record) => record,
  fromForm = (values) => values,
  invalidate = [],
  empty,
}) {
  const { filters, params, setFilter, setPage } = useListState({ search: "", ...extraFilters });
  const query = usePagedQuery(queryKey, url, params);
  const [editing, setEditing] = useState(null); // {} for new, a record to edit, null when closed
  const keys = [queryKey, ...invalidate];

  const save = useApiMutation(
    ({ id, body }) => (id ? apiClient.patch(`${url}/${id}`, body) : apiClient.post(url, body)),
    { invalidate: keys, success: (_r, { id }) => `${entity} ${id ? "updated" : "added"}.` }
  );
  const remove = useApiMutation((id) => apiClient.delete(`${url}/${id}`), { invalidate: keys, success: `${entity} deleted.` });

  async function handleDelete(record) {
    const ok = await confirm({ title: `Delete this ${entity.toLowerCase()}?`, message: `“${record.name ?? record.code}” will be removed. This can't be undone.`, confirmLabel: "Delete" });
    if (ok) remove.mutate(record._id);
  }

  const allColumns = [
    ...columns,
    ...(canManage
      ? [
          {
            key: "actions",
            header: <span className="visually-hidden">Actions</span>,
            className: "text-end text-nowrap",
            render: (record) => (
              <>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(record)} aria-label={`Edit ${record.name ?? record.code}`}>
                  <i className="bi bi-pencil" aria-hidden="true"></i>
                </button>
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => handleDelete(record)} aria-label={`Delete ${record.name ?? record.code}`}>
                  <i className="bi bi-trash3" aria-hidden="true"></i>
                </button>
              </>
            ),
          },
        ]
      : []),
  ];

  const toolbar = (
    <>
      <input type="search" className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} value={filters.search} onChange={(event) => setFilter("search", event.target.value)} />
      {toolbarExtra?.(filters, setFilter)}
      {canManage && (
        <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => setEditing({})}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Add {entity.toLowerCase()}
        </button>
      )}
    </>
  );

  const isNew = editing && !editing._id;
  return (
    <>
      <DataTable columns={allColumns} query={query} toolbar={toolbar} onPageChange={setPage} caption={`${entity} list`} empty={empty ?? { title: `No ${entity.toLowerCase()} records yet` }} />
      {editing && (
        <Modal
          title={isNew ? `Add ${entity.toLowerCase()}` : `Edit ${entity.toLowerCase()}`}
          onClose={() => !save.isPending && setEditing(null)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setEditing(null)} disabled={save.isPending}>
                Cancel
              </button>
              <button type="submit" form="crud-form" className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? <Spinner label="Saving" /> : "Save"}
              </button>
            </>
          }
        >
          <CrudForm
            fields={fields.filter((field) => isNew || !field.onlyOnCreate)}
            initial={toForm(editing)}
            onSubmit={(values) =>
              save.mutateAsync({ id: editing._id, body: fromForm(values, editing) }).then(() => setEditing(null), () => {})
            }
          />
        </Modal>
      )}
    </>
  );
}

function CrudForm({ fields, initial, onSubmit }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.name, initial[field.name] ?? (field.type === "checkbox" ? field.defaultValue ?? true : field.defaultValue ?? "")]))
  );
  const [errors, setErrors] = useState({});

  function submit(event) {
    event.preventDefault();
    const next = {};
    for (const field of fields) {
      if (field.required && (values[field.name] === "" || values[field.name] == null)) next[field.name] = `Enter ${field.label.toLowerCase()}.`;
    }
    setErrors(next);
    if (!Object.keys(next).length) onSubmit(values);
  }

  return (
    <form id="crud-form" onSubmit={submit} noValidate>
      {fields.map((field) => {
        const common = { label: field.label, hint: field.hint, error: errors[field.name], name: field.name };
        if (field.type === "checkbox") {
          return (
            <div className="form-check mb-3" key={field.name}>
              <input id={`crud-${field.name}`} type="checkbox" className="form-check-input" checked={Boolean(values[field.name])} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))} />
              <label className="form-check-label" htmlFor={`crud-${field.name}`}>
                {field.label}
              </label>
            </div>
          );
        }
        const onChange = (event) => setValues((current) => ({ ...current, [field.name]: event.target.value }));
        if (field.type === "select") {
          return (
            <FormField key={field.name} {...common} as="select" value={values[field.name]} onChange={onChange}>
              {!field.required && <option value="">None</option>}
              {field.required && <option value="">Choose…</option>}
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormField>
          );
        }
        return (
          <FormField
            key={field.name}
            {...common}
            as={field.type === "textarea" ? "textarea" : "input"}
            rows={field.type === "textarea" ? 3 : undefined}
            type={field.type === "textarea" ? undefined : field.type ?? "text"}
            value={values[field.name]}
            onChange={onChange}
          />
        );
      })}
    </form>
  );
}
