import React, { useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import FormField, { MobileField } from "../../components/ui/FormField.jsx";
import useListState from "../../hooks/useListState.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../lib/resource.js";
import { msg, t } from "../../i18n/index.js";

/**
 * List + create/edit/delete for simple reference data (authors, publishers,
 * suppliers, branches, rooms…) on a library CRUD endpoint (`{ data, meta }`).
 *
 * `fields`: [{ name, label, type?: "text"|"textarea"|"select"|"checkbox"|"number"|"email"|"tel",
 *             options?: [{ value, label }], required?, hint?, onlyOnCreate?,
 *             validate?: (value) => msg() error key or null (skipped when empty) }]
 * `columns`: DataTable columns (an actions column is appended).
 * `toForm(record)` / `fromForm(values)` convert between records and form values.
 * `entity`, `searchPlaceholder`, field labels/hints and string column headers are
 * English keys (mark them with msg()); they are translated here.
 */
export default function SimpleCrudSection({
  entity,
  queryKey,
  url,
  fields,
  columns,
  canManage = true,
  searchPlaceholder = msg("Search"),
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
  const name = t(entity);

  const save = useApiMutation(
    ({ id, body }) => (id ? apiClient.patch(`${url}/${id}`, body) : apiClient.post(url, body)),
    { invalidate: keys, success: (_r, { id }) => (id ? t("{entity} updated.", { entity: name }) : t("{entity} added.", { entity: name })) }
  );
  const remove = useApiMutation((id) => apiClient.delete(`${url}/${id}`), { invalidate: keys, success: t("{entity} deleted.", { entity: name }) });

  async function handleDelete(record) {
    const ok = await confirm({
      title: t("Delete this {entity}?", { entity: name.toLowerCase() }),
      message: t("“{name}” will be removed. This can't be undone.", { name: record.name ?? record.code }),
      confirmLabel: t("Delete"),
    });
    if (ok) remove.mutate(record._id);
  }

  const allColumns = [
    ...columns.map((column) => (typeof column.header === "string" ? { ...column, header: t(column.header) } : column)),
    ...(canManage
      ? [
          {
            key: "actions",
            header: <span className="visually-hidden">{t("Actions")}</span>,
            className: "text-end text-nowrap",
            render: (record) => (
              <>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(record)} aria-label={t("Edit {name}", { name: record.name ?? record.code })}>
                  <i className="bi bi-pencil" aria-hidden="true"></i>
                </button>
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => handleDelete(record)} aria-label={t("Delete {name}", { name: record.name ?? record.code })}>
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
      <input type="search" className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder={t(searchPlaceholder)} aria-label={t(searchPlaceholder)} value={filters.search} onChange={(event) => setFilter("search", event.target.value)} />
      {toolbarExtra?.(filters, setFilter)}
      {canManage && (
        <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => setEditing({})}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>{t("Add {entity}", { entity: name.toLowerCase() })}
        </button>
      )}
    </>
  );

  const isNew = editing && !editing._id;
  return (
    <>
      <DataTable columns={allColumns} query={query} toolbar={toolbar} onPageChange={setPage} caption={t("{entity} list", { entity: name })} empty={empty ?? { title: t("No {entity} records yet", { entity: name.toLowerCase() }) }} />
      {editing && (
        <Modal
          title={isNew ? t("Add {entity}", { entity: name.toLowerCase() }) : t("Edit {entity}", { entity: name.toLowerCase() })}
          onClose={() => !save.isPending && setEditing(null)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setEditing(null)} disabled={save.isPending}>
                {t("Cancel")}
              </button>
              <button type="submit" form="crud-form" className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? <Spinner label={t("Saving")} /> : t("Save")}
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
      if (field.required && (values[field.name] === "" || values[field.name] == null)) next[field.name] = t("Enter {field}.", { field: t(field.label).toLowerCase() });
      else if (field.validate && values[field.name] !== "") {
        const error = field.validate(values[field.name]);
        if (error) next[field.name] = t(error);
      }
    }
    setErrors(next);
    if (!Object.keys(next).length) onSubmit(values);
  }

  return (
    <form id="crud-form" onSubmit={submit} noValidate>
      {fields.map((field) => {
        const common = { label: t(field.label), hint: field.hint && t(field.hint), error: errors[field.name], name: field.name };
        if (field.type === "checkbox") {
          return (
            <div className="form-check mb-3" key={field.name}>
              <input id={`crud-${field.name}`} type="checkbox" className="form-check-input" checked={Boolean(values[field.name])} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))} />
              <label className="form-check-label" htmlFor={`crud-${field.name}`}>
                {t(field.label)}
              </label>
            </div>
          );
        }
        const onChange = (event) => setValues((current) => ({ ...current, [field.name]: event.target.value }));
        if (field.type === "select") {
          return (
            <FormField key={field.name} {...common} as="select" value={values[field.name]} onChange={onChange}>
              {!field.required && <option value="">{t("None")}</option>}
              {field.required && <option value="">{t("Choose…")}</option>}
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormField>
          );
        }
        if (field.type === "tel") return <MobileField key={field.name} {...common} hint={common.hint || undefined} value={values[field.name]} onChange={onChange} />;
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
