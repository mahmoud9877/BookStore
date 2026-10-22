import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { apiClient, getErrorMessage, responseData } from "../../lib/api-client.js";
import { formatDate, formatMoney, humanize } from "../../lib/format.js";
import { useActiveBranches } from "../branches/branch.queries.js";
import { useCurrentUserQuery } from "../auth/auth.queries.js";
import { CIRCULATION_KEYS } from "./circulation-keys.js";
import { useMemberLookup } from "./useMemberLookup.js";
import MemberSummary from "./MemberSummary.jsx";
import { msg, t } from "../../i18n/index.js";

const NEXT_STEP = {
  held: msg("Put it on the hold shelf: it is reserved for the next member, who has been notified."),
  transfer: msg("Put it in the transfer bin: it is going to another branch."),
  shelved: msg("Return it to the shelf."),
  damaged: msg("Set it aside: it was recorded as damaged."),
};

function useInvalidateCirculation() {
  const queryClient = useQueryClient();
  return () => Promise.all(CIRCULATION_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Errors stay in the panel (no toast): the desk reads them next to the form. */
function useDeskMutation(url) {
  const invalidate = useInvalidateCirculation();
  return useMutation({
    mutationFn: async (body) => (await responseData(apiClient.post(url, body))).data,
    onSuccess: invalidate,
  });
}

function CheckoutPanel() {
  const barcodeRef = useRef(null);
  const [barcode, setBarcode] = useState("");
  const [memberRef, setMemberRef] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [blocked, setBlocked] = useState(null); // message of a limit block that can be overridden
  const [result, setResult] = useState(null);
  const checkout = useDeskMutation("/loans/checkout");
  const member = useMemberLookup(memberRef);

  useEffect(() => barcodeRef.current?.focus(), []);

  async function submit(event) {
    event.preventDefault();
    setResult(null);
    if (!barcode.trim() || !memberRef.trim()) return;
    const body = { barcode: barcode.trim(), member: memberRef.trim(), ...(blocked && overrideReason.trim() && { overrideReason: overrideReason.trim() }) };
    try {
      const loan = await checkout.mutateAsync(body);
      setResult(loan);
      setBlocked(null);
      setOverrideReason("");
      setBarcode("");
      barcodeRef.current?.focus();
    } catch (error) {
      const message = getErrorMessage(error);
      // Limit and balance blocks may be overridden with a reason; suspensions and expiry may not.
      // Decided from the member's standing, not the (translated) message text.
      const standing = member.data;
      const overridable = error?.response?.status === 403 && (!standing || (standing.status === "active" && !standing.isExpired));
      setBlocked(overridable ? message : null);
    }
  }

  const error = checkout.error && !blocked ? getErrorMessage(checkout.error) : null;

  return (
    <section className="card card-body h-100" aria-labelledby="checkout-title">
      <h2 id="checkout-title" className="h5">
        <i className="bi bi-box-arrow-up-right me-2 text-primary" aria-hidden="true"></i>
        {t("Check out")}
      </h2>
      <form onSubmit={submit} noValidate>
        <div className="mb-3">
          <label htmlFor="checkout-member" className="form-label">
            {t("Member number")}
          </label>
          <input
            id="checkout-member"
            className="form-control scan-input"
            placeholder="M-0000001"
            autoComplete="off"
            value={memberRef}
            onChange={(event) => {
              setMemberRef(event.target.value);
              setBlocked(null);
            }}
          />
        </div>
        {member.data && (
          <div className="mb-3">
            <MemberSummary member={member.data} />
          </div>
        )}
        {member.error && memberRef.trim().length >= 3 && <p className="small text-danger">{t("No member with this number.")}</p>}
        <div className="mb-3">
          <label htmlFor="checkout-barcode" className="form-label">
            {t("Copy barcode")}
          </label>
          <input
            id="checkout-barcode"
            ref={barcodeRef}
            className="form-control scan-input"
            placeholder={t("Scan or type")}
            autoComplete="off"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
          />
        </div>
        {blocked && (
          <div className="alert alert-warning" role="alert">
            <p className="mb-2">{blocked}</p>
            <label htmlFor="override-reason" className="form-label small fw-semibold">
              {t("Lend anyway? Give a reason (recorded in the audit log)")}
            </label>
            <input
              id="override-reason"
              className="form-control form-control-sm"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
          </div>
        )}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={checkout.isPending || !barcode.trim() || !memberRef.trim() || (blocked && overrideReason.trim().length < 5)}
        >
          {checkout.isPending ? <Spinner label={t("Checking out")} /> : blocked ? t("Override and lend") : t("Check out")}
        </button>
      </form>
      {result && (
        <div className="alert alert-success mt-3 mb-0" role="status">
          {t("Lent “{title}” ({barcode}) to {name}. Due {date}.", {
            title: result.book?.bookTitle,
            barcode: result.copy?.barcode,
            name: result.member?.name,
            date: formatDate(result.dueAt),
          })}
        </div>
      )}
    </section>
  );
}

function ReturnPanel() {
  const { data: me } = useCurrentUserQuery();
  const { data: branches } = useActiveBranches();
  const barcodeRef = useRef(null);
  const [barcode, setBarcode] = useState("");
  const [branch, setBranch] = useState("");
  const [damaged, setDamaged] = useState(false);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState(null);
  const checkin = useDeskMutation("/loans/return");

  // Staff limited to their branches only see those as desks.
  const assigned = me?.branchScope === "all" ? [] : (me?.branches ?? []).map(String);
  const deskBranches = assigned.length ? branches.filter((item) => assigned.includes(item._id)) : branches;

  async function submit(event) {
    event.preventDefault();
    setResult(null);
    if (!barcode.trim()) return;
    try {
      const outcome = await checkin.mutateAsync({ barcode: barcode.trim(), ...(branch && { branch }), damaged, ...(notes.trim() && { notes: notes.trim() }) });
      setResult(outcome);
      setBarcode("");
      setDamaged(false);
      setNotes("");
      barcodeRef.current?.focus();
    } catch {
      // Shown below.
    }
  }

  return (
    <section className="card card-body h-100" aria-labelledby="return-title">
      <h2 id="return-title" className="h5">
        <i className="bi bi-box-arrow-in-down-left me-2 text-primary" aria-hidden="true"></i>
        {t("Return")}
      </h2>
      <form onSubmit={submit} noValidate>
        <div className="mb-3">
          <label htmlFor="return-branch" className="form-label">
            {t("Desk branch")}
          </label>
          <select id="return-branch" className="form-select" value={branch} onChange={(event) => setBranch(event.target.value)}>
            <option value="">{t("The copy's own branch")}</option>
            {deskBranches.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="return-barcode" className="form-label">
            {t("Copy barcode")}
          </label>
          <input
            id="return-barcode"
            ref={barcodeRef}
            className="form-control scan-input"
            placeholder={t("Scan or type")}
            autoComplete="off"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
          />
        </div>
        <div className="form-check mb-2">
          <input id="return-damaged" type="checkbox" className="form-check-input" checked={damaged} onChange={(event) => setDamaged(event.target.checked)} />
          <label htmlFor="return-damaged" className="form-check-label">
            {t("Returned damaged")}
          </label>
        </div>
        {damaged && (
          <div className="mb-3">
            <label htmlFor="return-notes" className="form-label">
              {t("What is damaged?")}
            </label>
            <input id="return-notes" className="form-control" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        )}
        {checkin.error && (
          <div className="alert alert-danger" role="alert">
            {getErrorMessage(checkin.error)}
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={checkin.isPending || !barcode.trim()}>
          {checkin.isPending ? <Spinner label={t("Returning")} /> : t("Return")}
        </button>
      </form>
      {result && (
        <div className="alert alert-success mt-3 mb-0" role="status">
          {t("Returned “{title}” from {name}.", { title: result.loan?.book?.bookTitle, name: result.loan?.member?.name })}{" "}
          {result.fine > 0 ? t("Overdue fine charged: {amount}.", { amount: formatMoney(result.fine) }) : t("No fine.")}
          <span className="d-block mt-1">
            <strong>{humanize(result.next)}:</strong> {t(NEXT_STEP[result.next])}
          </span>
        </div>
      )}
    </section>
  );
}

/** The circulation desk: scanner-friendly checkout and return side by side. */
export default function CirculationDeskPage() {
  return (
    <>
      <PageHeader title={t("Circulation desk")} description={t("Scan a member card and a barcode. A scanner's Enter submits the form.")} />
      <div className="row g-3">
        <div className="col-lg-6">
          <CheckoutPanel />
        </div>
        <div className="col-lg-6">
          <ReturnPanel />
        </div>
      </div>
    </>
  );
}
