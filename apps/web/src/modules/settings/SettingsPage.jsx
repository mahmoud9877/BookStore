import React, { useEffect, useState } from "react";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import { toast } from "../../components/ui/toast.store.js";
import { apiClient, useDataQuery } from "../../lib/resource.js";
import { getErrorMessage, responseData } from "../../lib/api-client.js";
import { humanize } from "../../lib/format.js";
import { toForm, toPayload } from "./settings-form.js";
import MembershipTypesPanel from "./MembershipTypesPanel.jsx";

const TEMPLATE_HINTS = {
  "loan.due_soon": "{{memberName}} {{title}} {{barcode}} {{dueDate}}",
  "loan.overdue": "{{memberName}} {{title}} {{barcode}} {{dueDate}}",
  "reservation.ready": "{{memberName}} {{title}} {{branchName}} {{expiresAt}}",
  "reservation.expired": "{{memberName}} {{title}}",
  "membership.expiring": "{{memberName}} {{membershipType}} {{expiresAt}}",
  "payment.received": "{{memberName}} {{amount}} {{receiptNumber}}",
  "fine.issued": "{{memberName}} {{fineType}} {{amount}} {{reason}}",
};

function Section({ title, description, children }) {
  return (
    <fieldset className="card card-body mb-3">
      <legend className="h6 mb-1 float-none">{title}</legend>
      {description && <p className="small text-muted">{description}</p>}
      <div className="row g-3">{children}</div>
    </fieldset>
  );
}

function NumberField({ id, label, hint, value, onChange, step = 1, min = 0, placeholder }) {
  return (
    <div className="col-sm-6 col-lg-4">
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} type="number" className="form-control" min={min} step={step} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <div id={`${id}-hint`} className="form-text">{hint}</div>}
    </div>
  );
}

function Toggle({ id, label, hint, checked, onChange }) {
  return (
    <div className="col-12">
      <div className="form-check form-switch">
        <input id={id} className="form-check-input" type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} />
        <label className="form-check-label" htmlFor={id}>{label}</label>
        {hint && <div id={`${id}-hint`} className="form-text mt-0">{hint}</div>}
      </div>
    </div>
  );
}

function PoliciesForm({ settings, onReload }) {
  const [{ form, version }, setState] = useState(() => toForm(settings));
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState("");
  const currency = form.currency;

  useEffect(() => {
    setState(toForm(settings));
    setConflict("");
  }, [settings]);

  const set = (section, key) => (value) =>
    setState((current) => ({ ...current, form: { ...current.form, [section]: { ...current.form[section], [key]: value } } }));
  const setTemplate = (type, part) => (event) =>
    setState((current) => {
      const templates = { ...current.form.notifications.templates, [type]: { ...current.form.notifications.templates[type], [part]: event.target.value } };
      return { ...current, form: { ...current.form, notifications: { ...current.form.notifications, templates } } };
    });
  const int = (section, key) => (value) => set(section, key)(value === "" ? "" : Number(value));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setConflict("");
    try {
      const saved = (await responseData(apiClient.put("/settings", toPayload(form, version)))).data;
      setState(toForm(saved));
      toast.success("Settings saved.");
    } catch (error) {
      if (error?.response?.status === 409) setConflict(getErrorMessage(error));
      else toast.error(getErrorMessage(error, "Couldn't save the settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Library policies">
      {conflict && (
        <div className="alert alert-warning d-flex flex-wrap gap-2 align-items-center justify-content-between" role="alert">
          <span>{conflict}</span>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onReload}>Reload settings</button>
        </div>
      )}
      <p className="text-muted small">
        These are your library's own policies. The defaults charge no fines and block nobody until you set them. Amounts are in {currency}.
      </p>

      <Section title="Currency" description="Fines and payments are recorded in this currency (ISO code). Changing it does not convert existing records.">
        <div className="col-sm-4">
          <label htmlFor="currency" className="form-label">Currency code</label>
          <input id="currency" className="form-control text-uppercase" maxLength={3} value={form.currency} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, currency: event.target.value.toUpperCase() } }))} />
        </div>
      </Section>

      <Section title="Circulation" description="Loan limits and periods come from each membership type; these rules apply to everyone.">
        <NumberField id="block-balance" label={`Block borrowing above balance (${currency})`} step="0.01" value={form.circulation.blockBorrowingAboveBalance} onChange={set("circulation", "blockBorrowingAboveBalance")} placeholder="No limit" hint="Leave empty to never block borrowing for unpaid fines." />
        <Toggle id="renew-reserved" label="Allow renewals while others are waiting" hint="Off: a loan can't be renewed if members are queued for the title." checked={form.circulation.allowRenewalWhenReserved} onChange={set("circulation", "allowRenewalWhenReserved")} />
        <Toggle id="return-home" label="Send copies returned elsewhere back to their branch" hint="Off: a copy returned at another branch stays there and becomes part of its stock." checked={form.circulation.returnToHomeBranch} onChange={set("circulation", "returnToHomeBranch")} />
      </Section>

      <Section title="Reservations">
        <NumberField id="hold-days" label="Days to collect a ready reservation" min={1} value={form.reservations.holdPickupDays} onChange={int("reservations", "holdPickupDays")} hint="After this the reservation expires and the copy goes to the next member." />
        <Toggle id="cross-branch" label="Allow pickup at a branch other than the copy's" hint="On: copies travel to the member's chosen branch." checked={form.reservations.allowCrossBranchPickup} onChange={set("reservations", "allowCrossBranchPickup")} />
      </Section>

      <Section title="Fines" description="Charged automatically when an item comes back late, damaged, or is declared lost.">
        <NumberField id="per-day" label={`Overdue fine per day (${currency})`} step="0.01" value={form.fines.overduePerDay} onChange={set("fines", "overduePerDay")} hint="0 charges no overdue fines." />
        <NumberField id="grace" label="Grace days" value={form.fines.graceDays} onChange={int("fines", "graceDays")} hint="Days late before the overdue fine starts." />
        <NumberField id="max-overdue" label={`Maximum overdue fine per loan (${currency})`} step="0.01" value={form.fines.maxOverduePerLoan} onChange={set("fines", "maxOverduePerLoan")} placeholder="No cap" />
        <NumberField id="lost-fee" label={`Lost item fee (${currency})`} step="0.01" value={form.fines.lostItemFee} onChange={set("fines", "lostItemFee")} placeholder="The copy's recorded cost" hint="Empty: charge the copy's recorded cost." />
        <NumberField id="damaged-fee" label={`Damaged item fee (${currency})`} step="0.01" value={form.fines.damagedItemFee} onChange={set("fines", "damagedItemFee")} />
      </Section>

      <Section title="Notifications" description="Members get in-app messages; email is sent by the background worker when enabled.">
        <Toggle id="email-enabled" label="Send email notifications" checked={form.notifications.emailEnabled} onChange={set("notifications", "emailEnabled")} />
        <NumberField id="due-soon" label="Due-date reminder (days before)" min={1} value={form.notifications.dueSoonDays} onChange={int("notifications", "dueSoonDays")} />
        <NumberField id="expiry-days" label="Membership expiry reminder (days before)" min={1} value={form.notifications.membershipExpiryDays} onChange={int("notifications", "membershipExpiryDays")} />
        <div className="col-12">
          <h2 className="h6 mt-2">Message templates</h2>
          <p className="small text-muted mb-2">Use the listed {"{{placeholders}}"}; unknown ones are left empty.</p>
          {Object.entries(form.notifications.templates).map(([type, template]) => (
            <details key={type} className="border rounded p-2 mb-2">
              <summary className="fw-semibold">{humanize(type.replace(".", " "))}</summary>
              <div className="mt-2">
                <label htmlFor={`${type}-subject`} className="form-label small">Subject</label>
                <input id={`${type}-subject`} className="form-control form-control-sm mb-2" value={template.subject} onChange={setTemplate(type, "subject")} />
                <label htmlFor={`${type}-body`} className="form-label small">Message</label>
                <textarea id={`${type}-body`} className="form-control form-control-sm" rows={4} value={template.body} onChange={setTemplate(type, "body")} aria-describedby={`${type}-hint`} />
                <div id={`${type}-hint`} className="form-text">Placeholders: {TEMPLATE_HINTS[type] ?? "{{memberName}}"}</div>
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Rooms" description="Limits for bookings members make themselves (staff bookings are not limited).">
        <NumberField id="max-hours" label="Longest booking (hours)" min={1} value={form.rooms.maxBookingHours} onChange={int("rooms", "maxBookingHours")} />
        <NumberField id="advance" label="Book up to (days ahead)" min={1} value={form.rooms.maxAdvanceDays} onChange={int("rooms", "maxAdvanceDays")} />
        <NumberField id="cutoff" label="Cancel at least (hours before)" value={form.rooms.cancellationCutoffHours} onChange={int("rooms", "cancellationCutoffHours")} />
      </Section>

      <div className="d-flex justify-content-end">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner label="Saving" /> : "Save settings"}
        </button>
      </div>
    </form>
  );
}

/** Library-wide policies and membership types. */
export default function SettingsPage() {
  const [tab, setTab] = useState("policies");
  const query = useDataQuery(["settings"], "/settings");

  return (
    <>
      <PageHeader title="Settings" description="Borrowing, fine, reservation, notification and room policies." />
      <ul className="nav nav-tabs mb-3" role="tablist">
        {[["policies", "Policies"], ["types", "Membership types"]].map(([key, label]) => (
          <li className="nav-item" role="presentation" key={key}>
            <button type="button" role="tab" aria-selected={tab === key} className={`nav-link ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      {tab === "types" ? (
        <MembershipTypesPanel />
      ) : query.isLoading ? (
        <p className="text-muted" aria-busy="true">Loading settings…</p>
      ) : query.error ? (
        <ErrorState message={getErrorMessage(query.error, "Couldn't load the settings.")} onRetry={query.refetch} />
      ) : (
        <PoliciesForm settings={query.data} onReload={query.refetch} />
      )}
    </>
  );
}
