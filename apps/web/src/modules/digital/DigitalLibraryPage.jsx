import React, { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import useListState from "../../hooks/useListState.js";
import { toast } from "../../components/ui/toast.store.js";
import { apiClient, getErrorMessage } from "../../lib/api-client.js";
import { usePagedQuery } from "../../lib/resource.js";
import { humanize } from "../../lib/format.js";
import { selectIsSignedIn, useAuthStore } from "../auth/auth.store.js";

const FORMATS = ["", "pdf", "epub", "audio", "video"];
const FORMAT_ICONS = { pdf: "file-earmark-pdf", epub: "book-half", audio: "headphones", video: "camera-video" };
const ACCESS_LABELS = { public: "Free for everyone", members: "Library members", membership_types: "Selected memberships" };

/** Messages for the access errors the file endpoint returns. */
function openError(error) {
  const status = error?.response?.status;
  if (status === 401) return "Sign in with your library account to open this publication.";
  if (status === 403) return "Your membership doesn't include this publication.";
  return getErrorMessage(error, "Couldn't open this publication.");
}

/**
 * Opens a protected file: fetched with the signed-in user's token (there is
 * never a public link) and shown from a temporary object URL.
 */
async function openPublication(publication) {
  const tab = window.open("", "_blank");
  try {
    const response = await apiClient.get(`/digital/${publication._id}/file`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    // Blob responses carry the JSON error as a blob: read its message.
    const text = await error?.response?.data?.text?.().catch(() => null);
    if (text) {
      try {
        error.response.data = JSON.parse(text);
      } catch {
        /* not JSON */
      }
    }
    toast.error(openError(error));
  }
}

/** Public catalogue of e-books, audio and video, opened only by those entitled. */
export default function DigitalLibraryPage() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const { filters, params, setFilter, setPage } = useListState({ search: "", format: "" }, { limit: 24 });
  const publications = usePagedQuery(["digital", "public"], "/digital", params);
  const [openingId, setOpeningId] = useState(null);
  const items = publications.data?.data ?? [];

  async function open(publication) {
    setOpeningId(publication._id);
    await openPublication(publication);
    setOpeningId(null);
  }

  return (
    <div className="container">
      <PageHeader title="Digital library" description="E-books, audiobooks and recordings you can open online." />
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          type="search"
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder="Search by title or author"
          aria-label="Search the digital library"
          value={filters.search}
          onChange={(event) => setFilter("search", event.target.value)}
        />
        <select className="form-select w-auto" aria-label="Format" value={filters.format} onChange={(event) => setFilter("format", event.target.value)}>
          {FORMATS.map((format) => (
            <option key={format || "all"} value={format}>
              {format ? humanize(format) : "All formats"}
            </option>
          ))}
        </select>
      </div>
      {!isSignedIn && (
        <p className="alert alert-info">
          Most titles are for library members. <Link to="/login">Sign in</Link> to open them.
        </p>
      )}
      {publications.isLoading ? (
        <p className="text-muted" aria-busy="true">
          Loading…
        </p>
      ) : publications.error ? (
        <ErrorState message={getErrorMessage(publications.error, "Couldn't load the digital library.")} onRetry={publications.refetch} />
      ) : items.length === 0 ? (
        <StatePanel icon="file-earmark" title="No digital publications found" />
      ) : (
        <>
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
            {items.map((publication) => (
              <div className="col" key={publication._id}>
                <article className="card h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex gap-2 align-items-start mb-2">
                      <i className={`bi bi-${FORMAT_ICONS[publication.format] ?? "file-earmark"} fs-3 text-primary`} aria-hidden="true"></i>
                      <div>
                        <h2 className="h6 mb-0">{publication.title}</h2>
                        {publication.authors && <div className="small text-muted">{publication.authors}</div>}
                      </div>
                    </div>
                    {publication.description && <p className="small text-muted">{publication.description}</p>}
                    <div className="small text-muted mt-auto mb-2">
                      {humanize(publication.format)} · {ACCESS_LABELS[publication.access] ?? humanize(publication.access)}
                    </div>
                    {publication.canOpen ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => open(publication)} disabled={openingId === publication._id}>
                        {openingId === publication._id ? <Spinner label="Opening" /> : `Open ${publication.title}`}
                      </button>
                    ) : (
                      <span className="small text-muted">
                        <i className="bi bi-lock me-1" aria-hidden="true"></i>
                        {isSignedIn ? "Not included in your membership" : "Sign in as a member to open"}
                      </span>
                    )}
                  </div>
                </article>
              </div>
            ))}
          </div>
          <Pagination meta={publications.data?.meta} onPageChange={setPage} label="Digital library pages" />
        </>
      )}
    </div>
  );
}
