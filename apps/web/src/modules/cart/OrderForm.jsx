import React from "react";
import useForm from "../../hooks/useForm.js";
import { formatPrice } from "../../lib/format.js";
import Spinner from "../../components/ui/Spinner.jsx";
import FormField, { MobileField } from "../../components/ui/FormField.jsx";
import { DiscountRow } from "./CouponBox.jsx";
import { PAYMENT_METHODS, checkoutSchema } from "./checkout.validation.js";
import { t } from "../../i18n/index.js";

/**
 * Delivery and payment details; `onSubmit` receives `{ address, phone, note, paymentType }`.
 * `total` already has the applied `coupon` (`{ code, discount }`) taken off.
 */
export default function OrderForm({ total, coupon, isSubmitting, onSubmit, onCancel }) {
  const { values, handleChange, field, handleSubmit } = useForm(
    { address: "", phone: "", note: "", paymentType: "card" },
    { schema: checkoutSchema }
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="checkout-title">
      <h2 id="checkout-title" className="h5 mb-3">
        {t("Delivery details")}
      </h2>
      <FormField label={t("Delivery address")} autoComplete="street-address" {...field("address")} />
      <MobileField hint={t("The courier will call this number.")} {...field("phone")} />
      <FormField label={t("Note for the courier (optional)")} as="textarea" rows={2} {...field("note")} />

      <fieldset className="mb-3">
        <legend className="form-label fs-6">{t("Payment")}</legend>
        <div className="d-grid gap-2">
          {PAYMENT_METHODS.map(({ value, label, description }) => (
            <label key={value} className="payment-option">
              <input
                type="radio"
                className="form-check-input mt-1"
                name="paymentType"
                value={value}
                checked={values.paymentType === value}
                onChange={handleChange}
              />
              <span>
                <span className="fw-semibold d-block">{t(label)}</span>
                <span className="small text-muted">{t(description)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {coupon && <DiscountRow coupon={coupon} />}
      <button type="submit" className="btn btn-primary w-100 py-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <Spinner label={t("Placing order")} />
        ) : values.paymentType === "card" ? (
          t("Continue to payment · {total}", { total: formatPrice(total) })
        ) : (
          t("Place order · {total}", { total: formatPrice(total) })
        )}
      </button>
      <button type="button" className="btn btn-link w-100 mt-1" onClick={onCancel} disabled={isSubmitting}>
        {t("Back to cart")}
      </button>
    </form>
  );
}
