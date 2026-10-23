import React, { useState } from "react";
import Modal from "../../../components/ui/Modal.jsx";
import Spinner from "../../../components/ui/Spinner.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import { apiClient, useApiMutation } from "../../../lib/resource.js";
import { formatMoney, toMinorUnits } from "../../../lib/format.js";
import { t } from "../../../i18n/index.js";
import { useMemberLookup } from "../../circulation/hooks/useMemberLookup.js";
import { FINANCE_KEYS, newIdempotencyKey } from "../constants/finance-keys.js";

/**
 * Records cash taken at the desk. Staff type major units (12.50); the API gets
 * minor units (1250) and an Idempotency-Key fixed for this form, so a double
 * click or a retry never records the payment twice.
 * Pass `member` (a loaded member) or let staff look one up by number.
 */
export default function CashPaymentModal({ member: givenMember, onClose }) {
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [memberRef, setMemberRef] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const lookup = useMemberLookup(givenMember ? "" : memberRef);
  const member = givenMember ?? lookup.data;
  const balance = member?.summary?.balance;
  const pay = useApiMutation(
    ({ memberId, minor }) => apiClient.post("/payments", { member: memberId, amount: minor }, { headers: { "Idempotency-Key": idempotencyKey } }),
    { invalidate: FINANCE_KEYS, success: (payment) => t("Payment recorded. Receipt {receipt}.", { receipt: payment.receiptNumber }), failure: t("Couldn't record the payment.") }
  );

  async function submit(event) {
    event.preventDefault();
    const minor = toMinorUnits(amount);
    if (!member) return setError(t("Choose a member."));
    if (!(minor > 0)) return setError(t("Enter an amount greater than zero."));
    if (balance != null && minor > balance) return setError(t("The member owes {amount}.", { amount: formatMoney(balance) }));
    setError("");
    try {
      await pay.mutateAsync({ memberId: member._id, minor });
      onClose();
    } catch {
      // Reported by the mutation.
    }
  }

  return (
    <Modal
      title={t("Record a cash payment")}
      size="sm"
      onClose={() => !pay.isPending && onClose()}
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={pay.isPending}>
            {t("Cancel")}
          </button>
          <button type="submit" form="cash-payment-form" className="btn btn-primary" disabled={pay.isPending}>
            {pay.isPending ? <Spinner label={t("Recording")} /> : t("Record payment")}
          </button>
        </>
      }
    >
      <form id="cash-payment-form" onSubmit={submit} noValidate>
        {givenMember ? (
          <p className="mb-3">
            <strong>{givenMember.name}</strong> <span className="text-muted">({givenMember.memberNumber})</span>
          </p>
        ) : (
          <FormField label={t("Member number")} value={memberRef} onChange={(event) => setMemberRef(event.target.value)} hint={lookup.data ? lookup.data.name : undefined} autoComplete="off" />
        )}
        {balance != null && <p className="small text-muted">{t("Outstanding balance: {amount}. Oldest fines are paid first.", { amount: formatMoney(balance) })}</p>}
        <FormField label={t("Amount")} type="number" min="0" step="0.01" className="" value={amount} onChange={(event) => setAmount(event.target.value)} error={error || undefined} />
      </form>
    </Modal>
  );
}
