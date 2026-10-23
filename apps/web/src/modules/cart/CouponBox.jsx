import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Spinner from "../../components/ui/Spinner.jsx";
import { checkCoupon } from "../coupons/coupon.service.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { formatPrice } from "../../lib/format.js";
import { t } from "../../i18n/index.js";

/**
 * Coupon code + Apply. The API checks the code against the cart
 * (POST /coupons/check); `onApply` receives `{ code, discount, total, … }`.
 * Once applied, shows the code with a Remove button instead.
 */
export default function CouponBox({ applied, onApply, onRemove }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const check = useMutation({ mutationFn: checkCoupon });

  async function apply(event) {
    event.preventDefault();
    if (!code.trim()) {
      setError(t("Enter a coupon code."));
      return;
    }
    setError("");
    try {
      onApply(await check.mutateAsync(code));
      setCode("");
    } catch (err) {
      setError(getErrorMessage(err, t("We couldn't check this coupon. Please try again.")));
    }
  }

  if (applied) {
    return (
      <div className="coupon-applied">
        <span className="small">
          <i className="bi bi-ticket-perforated me-1" aria-hidden="true"></i>
          {t("Coupon {code} applied", { code: applied.code })}
        </span>
        <button type="button" className="btn btn-sm btn-link px-0" onClick={onRemove} aria-label={t("Remove coupon {code}", { code: applied.code })}>
          {t("Remove")}
        </button>
      </div>
    );
  }

  return (
    <form className="coupon-box" onSubmit={apply} noValidate>
      <label htmlFor="coupon-code" className="form-label small fw-semibold">
        {t("Coupon code")}
      </label>
      <div className="input-group input-group-sm has-validation">
        <input
          id="coupon-code"
          className={`form-control text-uppercase ${error ? "is-invalid" : ""}`}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "coupon-code-error" : undefined}
        />
        <button type="submit" className="btn btn-outline-primary" disabled={check.isPending}>
          {check.isPending ? <Spinner label={t("Checking coupon")} /> : t("Apply")}
        </button>
        {error && (
          <div id="coupon-code-error" className="invalid-feedback" role="alert">
            {error}
          </div>
        )}
      </div>
    </form>
  );
}

/** "Discount (SAVE10)  −EGP 64" in the order summary. */
export function DiscountRow({ coupon }) {
  return (
    <div className="summary-row text-success">
      <span>{t("Discount ({code})", { code: coupon.code })}</span>
      <span>{`−${formatPrice(coupon.discount)}`}</span>
    </div>
  );
}
