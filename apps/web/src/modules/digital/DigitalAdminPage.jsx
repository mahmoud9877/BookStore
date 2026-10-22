import React, { useState } from "react";
import { openProtectedFile } from "../copies/blob.js";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import FormField from "../../components/ui/FormField.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import useListState from "../../hooks/useListState.js";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { apiClient, useApiMutation, usePagedQuery } from "../../lib/resource.js";
import { formatDate, humanize } from "../../lib/format.js";

const ACCESS = [
  ["public", "Anyone"],
  ["members", "Members (whose type includes digital)"],
  ["membership_types", "Only chosen membership types"],
  ["staff", "Staff only"],
];
const LICENSES = ["public_domain", "open_license", "licensed", "owned"];
const ACCEPT = "application/pdf,application/epub+zip,audio/mpeg,video/mp4";
const INVALIDATE = [["digital"]];

function useMembershipTypes() {
  const query = usePagedQuery(["membership-types", "options"], "/membership-types", { limit: 100 });
  return query.data?.data ?? [];
}

const toValues = (publication) => ({
  title: publication?.title ?? "",
  authors: publication?.authors ?? "",
  description: publication?.description ?? "",
  access: publication?.access ?? "members",
  membershipTypes: publication?.membershipTypes?.map(String) ?? [],
  allowDownload: publication?.allowDownload ?? false,
  isPublished: publication?.isPublished ?? false,
  licenseType: publication?.license?.type ?? "licensed",
  licenseHolder: publication?.license?.holder ?? "",
  licenseExpiresAt: publication?.license?.expiresAt ? String(publication.license.expiresAt).slice(0, 10) : "",
  licenseTerms: publication?.license?.terms ?? "",
});

/** Upload (new) or edit (existing) a publication's metadata, access and licence. */
function PublicationForm({ publication, onSubmit }) {
  const types = useMembershipTypes();
  const [values, setValues] = useState(() => toValues(publication));
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!values.title.trim()) next.title = "Enter a title.";
    if (!publication && !file) next.file = "Choose the file to upload.";
    if (values.access === "membership_types" && !values.membershipTypes.length) next.membershipTypes = "Choose at least one membership type.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit(values, file);
  }

  return (
    <form id="publication-form" onSubmit={submit} noValidate>
      {!publication && (
        <div className="mb-3">
          <label htmlFor="publication-file" className="form-label">
            File
          </label>
          <input id="publication-file" type="file" accept={ACCEPT} className={`form-control ${errors.file ? "is-invalid" : ""}`} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          {errors.file ? <div className="invalid-feedback">{errors.file}</div> : <div className="form-text">PDF, EPUB, MP3 or MP4, up to 200 MB. Stored privately.</div>}
        </div>
      )}
      <FormField label="Title" value={values.title} onChange={set("title")} error={errors.title} />
      <FormField label="Authors" value={values.authors} onChange={set("authors")} />
      <FormField label="Description" as="textarea" rows={2} value={values.description} onChange={set("description")} />
      <FormField label="Who may open it" as="select" value={values.access} onChange={set("access")}>
        {ACCESS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </FormField>
      {values.access === "membership_types" && (
        <fieldset className="mb-3">
          <legend className="form-label">Membership types</legend>
          {types.map((type) => (
            <div className="form-check" key={type._id}>
              <input
                id={`type-${type._id}`}
                type="checkbox"
                className="form-check-input"
                checked={values.membershipTypes.includes(type._id)}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    membershipTypes: event.target.checked ? [...current.membershipTypes, type._id] : current.membershipTypes.filter((id) => id !== type._id),
                  }))
                }
              />
              <label className="form-check-label" htmlFor={`type-${type._id}`}>
                {type.name}
              </label>
            </div>
          ))}
          {errors.membershipTypes && <div className="invalid-feedback d-block">{errors.membershipTypes}</div>}
        </fieldset>
      )}
      <div className="row g-2">
        <div className="col-sm-6">
          <FormField label="Licence" as="select" className="" value={values.licenseType} onChange={set("licenseType")}>
            {LICENSES.map((license) => (
              <option key={license} value={license}>
                {humanize(license)}
              </option>
            ))}
          </FormField>
        </div>
        <div className="col-sm-6">
          <FormField label="Licence expires" type="date" className="" value={values.licenseExpiresAt} onChange={set("licenseExpiresAt")} hint="After this date it is no longer served." />
        </div>
        <div className="col-12">
          <FormField label="Licence holder" className="" value={values.licenseHolder} onChange={set("licenseHolder")} />
        </div>
        <div className="col-12">
          <FormField label="Licence terms" as="textarea" rows={2} value={values.licenseTerms} onChange={set("licenseTerms")} />
        </div>
      </div>
      <div className="form-check">
        <input id="allow-download" type="checkbox" className="form-check-input" checked={values.allowDownload} onChange={set("allowDownload")} />
        <label className="form-check-label" htmlFor="allow-download">
          Allow downloading (otherwise viewed in the browser)
        </label>
      </div>
      <div className="form-check">
        <input id="is-published" type="checkbox" className="form-check-input" checked={values.isPublished} onChange={set("isPublished")} />
        <label className="form-check-label" htmlFor="is-published">
          Published (listed in the digital library)
        </label>
      </div>
    </form>
  );
}

/** The fields the API takes, from the form values (multipart sends strings). */
function toFields(values) {
  return {
    title: values.title.trim(),
    authors: values.authors,
    description: values.description,
    access: values.access,
    membershipTypes: values.access === "membership_types" ? values.membershipTypes.join(",") : "",
    allowDownload: String(values.allowDownload),
    isPublished: String(values.isPublished),
    licenseType: values.licenseType,
    licenseHolder: values.licenseHolder,
    licenseExpiresAt: values.licenseExpiresAt,
    licenseTerms: values.licenseTerms,
  };
}

/** Staff page: digital publications, their access rules and licences. */
export default function DigitalAdminPage() {
  const { filters, params, setFilter, setPage } = useListState({ search: "", includeUnpublished: true });
  const query = usePagedQuery(["digital", "admin"], "/digital", params);
  const [editing, setEditing] = useState(null); // {} for a new upload, a publication to edit

  const upload = useApiMutation(
    ({ values, file }) => {
      const formData = new FormData();
      formData.append("file", file);
      for (const [key, value] of Object.entries(toFields(values))) if (value !== "") formData.append(key, value);
      return apiClient.post("/digital", formData);
    },
    { invalidate: INVALIDATE, success: "Publication uploaded." }
  );
  const update = useApiMutation(
    ({ id, values }) => {
      const fields = toFields(values);
      return apiClient.patch(`/digital/${id}`, {
        ...fields,
        allowDownload: values.allowDownload,
        isPublished: values.isPublished,
        membershipTypes: values.access === "membership_types" ? values.membershipTypes : [],
        licenseExpiresAt: values.licenseExpiresAt || "",
      });
    },
    { invalidate: INVALIDATE, success: "Publication updated." }
  );
  const togglePublished = useApiMutation(({ id, isPublished }) => apiClient.patch(`/digital/${id}`, { isPublished }), {
    invalidate: INVALIDATE,
    success: (publication) => (publication.isPublished ? "Published." : "Unpublished."),
  });
  const remove = useApiMutation((id) => apiClient.delete(`/digital/${id}`), { invalidate: INVALIDATE, success: "Publication deleted." });
  const saving = upload.isPending || update.isPending;

  async function handleDelete(publication) {
    if (await confirm({ title: "Delete this publication?", message: `“${publication.title}” and its file will be removed.`, confirmLabel: "Delete" })) remove.mutate(publication._id);
  }

  async function open(publication) {
    try {
      await openProtectedFile(`/digital/${publication._id}/file`, { fileName: publication.title });
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't open the file."));
    }
  }

  function save(values, file) {
    const request = editing._id ? update.mutateAsync({ id: editing._id, values }) : upload.mutateAsync({ values, file });
    request.then(() => setEditing(null), () => {});
  }

  const columns = [
    { key: "title", header: "Title", render: (publication) => <span className="fw-semibold">{publication.title}</span> },
    { key: "format", header: "Format", hideBelow: "md", render: (publication) => publication.format?.toUpperCase() },
    { key: "access", header: "Access", hideBelow: "md", render: (publication) => ACCESS.find(([value]) => value === publication.access)?.[1] },
    { key: "license", header: "Licence", hideBelow: "lg", render: (publication) => `${humanize(publication.license?.type ?? "")}${publication.license?.expiresAt ? ` · until ${formatDate(publication.license.expiresAt)}` : ""}` },
    { key: "isPublished", header: "Status", render: (publication) => <StatusBadge status={publication.isPublished ? "active" : "closed"} label={publication.isPublished ? "Published" : "Draft"} /> },
    {
      key: "actions",
      header: <span className="visually-hidden">Actions</span>,
      className: "text-end text-nowrap",
      render: (publication) => (
        <>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => open(publication)} aria-label={`Open ${publication.title}`}>
            <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => togglePublished.mutate({ id: publication._id, isPublished: !publication.isPublished })} aria-label={`${publication.isPublished ? "Unpublish" : "Publish"} ${publication.title}`}>
            <i className={`bi bi-${publication.isPublished ? "eye-slash" : "eye"}`} aria-hidden="true"></i>
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(publication)} aria-label={`Edit ${publication.title}`}>
            <i className="bi bi-pencil" aria-hidden="true"></i>
          </button>
          <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => handleDelete(publication)} aria-label={`Delete ${publication.title}`}>
            <i className="bi bi-trash3" aria-hidden="true"></i>
          </button>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Digital library"
        description="Files are stored privately and only streamed to people the access rule and licence allow."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            <i className="bi bi-upload me-1" aria-hidden="true"></i>Upload
          </button>
        }
      />
      <DataTable
        columns={columns}
        query={query}
        onPageChange={setPage}
        caption="Digital publications"
        toolbar={<input type="search" className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder="Search by title or author" aria-label="Search publications" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} />}
        empty={{ icon: "file-earmark-pdf", title: "No digital publications yet" }}
      />
      {editing && (
        <Modal
          title={editing._id ? "Edit publication" : "Upload a publication"}
          onClose={() => !saving && setEditing(null)}
          footer={
            <>
              <button type="button" className="btn btn-light" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="publication-form" className="btn btn-primary" disabled={saving}>
                {saving ? <Spinner label="Saving" /> : editing._id ? "Save" : "Upload"}
              </button>
            </>
          }
        >
          <PublicationForm publication={editing._id ? editing : null} onSubmit={save} />
        </Modal>
      )}
    </>
  );
}
