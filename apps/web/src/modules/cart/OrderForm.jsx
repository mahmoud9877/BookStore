import React from "react";
import useForm from "../../hooks/useForm.js";
import { formatPrice } from "../../lib/format.js";
import Spinner from "../../components/ui/Spinner.jsx";
import FormField from "../../components/ui/FormField.jsx";
import { PAYMENT_METHODS, checkoutSchema } from "./checkout.validation.js";

/** Delivery and payment details; `onSubmit` receives `{ address, phone, note, paymentType }`. */
export default function OrderForm({ total, isSubmitting, onSubmit, onCancel }) {
  const { values, handleChange, field, handleSubmit } = useForm(
    { address: "", phone: "", note: "", paymentType: "card" },
    { schema: checkoutSchema }
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="checkout-title">
      <h2 id="checkout-title" className="h5 mb-3">
        Delivery details
      </h2>
      <FormField label="Delivery address" autoComplete="street-address" {...field("address")} />
      <FormField
        label="Phone"
        type="tel"
        autoComplete="tel"
        hint="The courier will call this number."
        {...field("phone")}
      />
      <FormField label="Note for the courier (optional)" as="textarea" rows={2} {...field("note")} />

      <fieldset className="mb-3">
        <legend className="form-label fs-6">Payment</legend>
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
                <span className="fw-semibold d-block">{label}</span>
                <span className="small text-muted">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary w-100 py-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <Spinner label="Placing order" />
        ) : values.paymentType === "card" ? (
          `Continue to payment · ${formatPrice(total)}`
        ) : (
          `Place order · ${formatPrice(total)}`
        )}
      </button>
      <button type="button" className="btn btn-link w-100 mt-1" onClick={onCancel} disabled={isSubmitting}>
        Back to cart
      </button>
    </form>
  );
}
