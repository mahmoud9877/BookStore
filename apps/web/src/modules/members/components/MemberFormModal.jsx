import React, { useState } from "react";
import Modal from "../../../components/ui/Modal.jsx";
import Spinner from "../../../components/ui/Spinner.jsx";
import FormField, { MobileField } from "../../../components/ui/FormField.jsx";
import { apiClient, useApiMutation, useDataQuery } from "../../../lib/resource.js";
import { useActiveBranches } from "../../branches/queries/branch.queries.js";
import { humanize } from "../../../lib/format.js";
import { isValidMobile } from "../../../lib/phone.js";
import { t, tp } from "../../../i18n/index.js";

const KINDS = ["individual", "student", "researcher", "institution"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialValues = (member) => ({
  name: member?.name ?? "",
  kind: member?.kind ?? "individual",
  email: member?.email ?? "",
  phone: member?.phone ?? "",
  address: member?.address ?? "",
  institution: member?.institution ?? "",
  membershipType: member?.membershipType?._id ?? "",
  homeBranch: member?.homeBranch?._id ?? "",
  userEmail: "",
  notes: member?.notes ?? "",
});

/** Checks a member form; resolves `{ field: message }`. */
export function validateMember(values, { isNew }) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = t("Enter the member's name.");
  if (values.email && !EMAIL.test(values.email)) errors.email = t("Enter a valid email address.");
  if (values.userEmail && !EMAIL.test(values.userEmail)) errors.userEmail = t("Enter a valid email address.");
  if (values.phone?.trim() && !isValidMobile(values.phone)) errors.phone = t("Enter a valid mobile number.");
  if (isNew && !values.membershipType) errors.membershipType = t("Choose a membership type.");
  if (isNew && !values.homeBranch) errors.homeBranch = t("Choose the home branch.");
  return errors;
}

/** Registers a member, or edits one when `member` is given. */
export default function MemberFormModal({ member, onClose, onSaved }) {
  const isNew = !member;
  const [values, setValues] = useState(() => initialValues(member));
  const [errors, setErrors] = useState({});
  const { data: branches } = useActiveBranches();
  const types = useDataQuery(["membership-types", "active"], "/membership-types", { isActive: true, limit: 100 });
  const save = useApiMutation((body) => (isNew ? apiClient.post("/members", body) : apiClient.patch(`/members/${member._id}`, body)), {
    invalidate: [["members"]],
    success: (saved) => (isNew ? t("Registered {name} ({number}).", { name: saved.name, number: saved.memberNumber }) : t("Member updated.")),
    failure: t("Couldn't save the member."),
  });

  const field = (name) => ({ name, value: values[name], onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })), error: errors[name] });

  async function submit(event) {
    event.preventDefault();
    const found = validateMember(values, { isNew });
    setErrors(found);
    if (Object.keys(found).length) return;
    // References are sent only when chosen; clearing contact fields is allowed when editing.
    const body = Object.fromEntries(
      Object.entries(values).filter(([key, value]) => value !== "" || (!isNew && !["membershipType", "homeBranch", "userEmail"].includes(key)))
    );
    try {
      const saved = await save.mutateAsync(body);
      onSaved?.(saved);
      onClose();
    } catch {
      // Reported by the mutation.
    }
  }

  return (
    <Modal
      title={isNew ? t("Register a member") : t("Edit {name}", { name: member.name })}
      onClose={() => !save.isPending && onClose()}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={save.isPending}>
            {t("Cancel")}
          </button>
          <button type="submit" form="member-form" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? <Spinner label={t("Saving")} /> : isNew ? t("Register") : t("Save")}
          </button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} noValidate>
        <div className="row g-2">
          <div className="col-sm-8">
            <FormField label={t("Name")} className="" autoComplete="off" {...field("name")} />
          </div>
          <div className="col-sm-4">
            <FormField label={t("Kind")} as="select" className="" {...field("kind")}>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {humanize(kind)}
                </option>
              ))}
            </FormField>
          </div>
          <div className="col-sm-6">
            <FormField label={t("Membership type")} as="select" className="" {...field("membershipType")}>
              <option value="">{isNew ? t("Choose…") : t("Keep current")}</option>
              {(types.data ?? []).map((type) => (
                <option key={type._id} value={type._id}>
                  {t("{name} — {loans}, {days}", { name: type.name, loans: tp("loan", type.loanLimit), days: tp("day", type.loanPeriodDays) })}
                </option>
              ))}
            </FormField>
          </div>
          <div className="col-sm-6">
            <FormField label={t("Home branch")} as="select" className="" {...field("homeBranch")}>
              <option value="">{isNew ? t("Choose…") : t("Keep current")}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </FormField>
          </div>
          <div className="col-sm-6">
            <FormField label={t("Email")} type="email" className="" {...field("email")} />
          </div>
          <div className="col-sm-6">
            <MobileField className="" {...field("phone")} />
          </div>
          <div className="col-sm-6">
            <FormField label={t("Institution")} className="" {...field("institution")} />
          </div>
          <div className="col-sm-6">
            <FormField label={t("Address")} className="" {...field("address")} />
          </div>
          <div className="col-12">
            <FormField
              label={t("Link to an online account (email)")}
              type="email"
              className=""
              hint={t("Optional. The member then sees their loans, reservations and fines when signed in.")}
              {...field("userEmail")}
            />
          </div>
          <div className="col-12">
            <FormField label={t("Notes")} as="textarea" rows={2} className="" {...field("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
