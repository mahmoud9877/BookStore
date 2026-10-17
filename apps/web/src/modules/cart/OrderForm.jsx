import React from "react";
import useForm from "../../hooks/useForm.js";

/** Delivery and payment details; `onSubmit` receives `{ address, phone, note, paymentType }`. */
export default function OrderForm({ isSubmitting, onSubmit }) {
  const { values, handleChange } = useForm({ address: "", phone: "", note: "", paymentType: "card" });
  const isComplete = values.address.trim() && values.phone.trim();

  return (
    <div className="order-form">
      <h4>Enter your details:</h4>
      <input
        type="text"
        name="address"
        className="form-control mb-3"
        placeholder="Enter your address"
        aria-label="Address"
        value={values.address}
        onChange={handleChange}
      />
      <input
        type="tel"
        name="phone"
        className="form-control mb-3"
        placeholder="Enter your phone"
        aria-label="Phone"
        value={values.phone}
        onChange={handleChange}
      />
      <textarea
        name="note"
        className="form-control mb-3"
        placeholder="Add special instructions"
        aria-label="Order note"
        value={values.note}
        onChange={handleChange}
      />
      <select
        name="paymentType"
        className="form-select mb-3"
        aria-label="Payment method"
        value={values.paymentType}
        onChange={handleChange}
      >
        <option value="card">Card</option>
        <option value="cash">Cash</option>
      </select>
      <button
        className="btn btn-success"
        onClick={() => onSubmit(values)}
        disabled={isSubmitting || !isComplete}
      >
        {isSubmitting ? "Placing Order..." : "Confirm Order"}
      </button>
    </div>
  );
}
