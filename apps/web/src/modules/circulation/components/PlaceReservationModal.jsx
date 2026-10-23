import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal from "../../../components/ui/Modal.jsx";
import Spinner from "../../../components/ui/Spinner.jsx";
import { apiClient, fetchJson, useApiMutation } from "../../../lib/resource.js";
import { formatName, formatTitle, humanize } from "../../../lib/format.js";
import { CIRCULATION_KEYS } from "../constants/circulation-keys.js";
import { useMemberLookup } from "../hooks/useMemberLookup.js";
import BranchSelect from "./BranchSelect.jsx";
import { t } from "../../../i18n/index.js";

/** Staff place a reservation for a member: find the member, the title and the pickup branch. */
export default function PlaceReservationModal({ onClose, initialMember = "" }) {
  const [memberRef, setMemberRef] = useState(initialMember);
  const [search, setSearch] = useState("");
  const [book, setBook] = useState(null);
  const [pickupBranch, setPickupBranch] = useState("");
  const member = useMemberLookup(memberRef);
  const books = useQuery({
    queryKey: ["catalog", "search", search],
    queryFn: () => fetchJson("/catalog/search", { q: search, limit: 8 }),
    enabled: search.trim().length >= 2,
  });
  const place = useApiMutation((body) => apiClient.post("/reservations", body), {
    invalidate: CIRCULATION_KEYS,
    success: (reservation) => t("Reservation placed ({status}).", { status: humanize(reservation.status).toLowerCase() }),
    failure: t("Couldn't place this reservation."),
  });

  const ready = member.data && book && pickupBranch;

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    try {
      await place.mutateAsync({ member: member.data._id, book: book._id, pickupBranch });
      onClose();
    } catch {
      // Reported by the mutation.
    }
  }

  return (
    <Modal
      title={t("Place a reservation")}
      onClose={() => !place.isPending && onClose()}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={place.isPending}>
            {t("Cancel")}
          </button>
          <button type="submit" form="reservation-form" className="btn btn-primary" disabled={!ready || place.isPending}>
            {place.isPending ? <Spinner label={t("Placing")} /> : t("Place reservation")}
          </button>
        </>
      }
    >
      <form id="reservation-form" onSubmit={submit} noValidate>
        <div className="mb-3">
          <label htmlFor="reservation-member" className="form-label">
            {t("Member number")}
          </label>
          <input id="reservation-member" className="form-control scan-input" value={memberRef} onChange={(event) => setMemberRef(event.target.value)} autoComplete="off" />
          {member.data && <div className="form-text text-success">{member.data.name}</div>}
          {member.error && <div className="form-text text-danger">{t("No member with this number.")}</div>}
        </div>
        <div className="mb-3">
          <label htmlFor="reservation-book" className="form-label">
            {t("Title")}
          </label>
          {book ? (
            <div className="d-flex align-items-center gap-2">
              <span className="fw-semibold">{formatTitle(book.bookTitle)}</span>
              <button type="button" className="btn btn-sm btn-link" onClick={() => setBook(null)}>
                {t("Change")}
              </button>
            </div>
          ) : (
            <>
              <input
                id="reservation-book"
                type="search"
                className="form-control"
                placeholder={t("Search by title, author or ISBN")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {books.data?.data?.length > 0 && (
                <ul className="list-group mt-2" aria-label={t("Matching titles")}>
                  {books.data.data.map((item) => (
                    <li key={item._id} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                      <span>
                        {formatTitle(item.bookTitle)} <span className="small text-muted">{t("by {author}", { author: formatName(item.author) })}</span>
                        <span className="d-block small text-muted">
                          {t("{available} of {total} available", { available: item.availability?.available ?? 0, total: item.availability?.total ?? 0 })}
                        </span>
                      </span>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setBook(item)} aria-label={t("Choose {title}", { title: formatTitle(item.bookTitle) })}>
                        {t("Choose")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {books.data?.data?.length === 0 && <div className="form-text">{t("No matching titles.")}</div>}
            </>
          )}
        </div>
        <BranchSelect id="reservation-branch" label={t("Pickup branch")} value={pickupBranch} onChange={setPickupBranch} allLabel={t("Choose…")} />
      </form>
    </Modal>
  );
}
