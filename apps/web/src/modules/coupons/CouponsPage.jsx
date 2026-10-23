import React from "react";
import SimpleCrudSection from "../authors/SimpleCrudSection.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { CURRENCY } from "../../config/api.js";
import { endOfDay, formatDate, formatNumber, formatPrice, toDateInput } from "../../lib/format.js";
import { msg, t } from "../../i18n/index.js";

const CODE = /^[A-Z0-9_-]{3,30}$/;

/** "20%" or "EGP 50". */
export const couponDiscount = (coupon) => (coupon.type === "percent" ? `${formatNumber(coupon.value)}%` : formatPrice(coupon.value));

/** Active, inactive (switched off), expired or used up. */
function CouponStatus({ coupon }) {
  if (!coupon.isActive) return <StatusBadge status="closed" label={t("Inactive")} />;
  if (coupon.expiresAt && new Date(coupon.expiresAt) <= new Date()) return <StatusBadge status="expired" label={t("Expired")} />;
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return <StatusBadge status="withdrawn" label={t("Used up")} />;
  return <StatusBadge status="active" label={t("Active")} />;
}

const COLUMNS = [
  { key: "code", header: msg("Code"), render: (coupon) => <span className="scan-input fw-semibold">{coupon.code}</span> },
  { key: "value", header: msg("Discount"), render: couponDiscount },
  { key: "minOrder", header: msg("Minimum order"), hideBelow: "md", render: (coupon) => (coupon.minOrder ? formatPrice(coupon.minOrder) : "—") },
  {
    key: "usedCount",
    header: msg("Uses"),
    render: (coupon) => `${formatNumber(coupon.usedCount ?? 0)} / ${coupon.maxUses == null ? "∞" : formatNumber(coupon.maxUses)}`,
  },
  { key: "expiresAt", header: msg("Expires"), hideBelow: "md", render: (coupon) => (coupon.expiresAt ? formatDate(coupon.expiresAt) : t("Never")) },
  { key: "isActive", header: msg("Status"), render: (coupon) => <CouponStatus coupon={coupon} /> },
];

const positive = (value) => (Number(value) > 0 ? null : msg("Enter a number above 0."));

const toForm = (coupon) => ({
  code: coupon.code ?? "",
  type: coupon.type ?? "percent",
  value: coupon.value ?? "",
  minOrder: coupon.minOrder ?? 0,
  maxUses: coupon.maxUses ?? "",
  expiresAt: toDateInput(coupon.expiresAt),
  isActive: coupon.isActive ?? true,
});

const fromForm = (values) => ({
  code: values.code.trim().toUpperCase(),
  type: values.type,
  value: Number(values.value),
  minOrder: values.minOrder === "" ? 0 : Number(values.minOrder),
  maxUses: values.maxUses === "" ? null : Number(values.maxUses),
  expiresAt: values.expiresAt ? endOfDay(values.expiresAt) : null, // valid through the chosen day
  isActive: values.isActive,
});

/** Staff page: discount codes shoppers enter at checkout. */
export default function CouponsPage() {
  const fields = [
    {
      name: "code",
      label: msg("Code"),
      required: true,
      hint: msg("3–30 letters, digits, - or _, e.g. SUMMER20. Shoppers type it at checkout."),
      validate: (value) => (CODE.test(value.trim().toUpperCase()) ? null : msg("Use 3–30 letters, digits, - or _.")),
    },
    {
      name: "type",
      label: msg("Discount type"),
      type: "select",
      required: true,
      options: [
        { value: "percent", label: t("Percentage of the order") },
        { value: "fixed", label: t("Fixed amount ({currency})", { currency: CURRENCY }) },
      ],
    },
    { name: "value", label: msg("Discount value"), type: "number", required: true, hint: msg("1–100 for a percentage; an amount for a fixed discount."), validate: positive },
    { name: "minOrder", label: msg("Minimum order"), type: "number", hint: msg("The cart subtotal needed to use the coupon. 0 for none.") },
    {
      name: "maxUses",
      label: msg("Maximum uses"),
      type: "number",
      hint: msg("Leave empty for unlimited."),
      validate: (value) => (Number.isInteger(Number(value)) && Number(value) >= 1 ? null : msg("Enter a whole number of at least 1.")),
    },
    { name: "expiresAt", label: msg("Expires on"), type: "date", hint: msg("Leave empty for no end date.") },
    { name: "isActive", label: msg("Active (shoppers can use it)"), type: "checkbox" },
  ];

  return (
    <>
      <PageHeader title={t("Coupons")} description={t("Discount codes shoppers enter at checkout.")} />
      <SimpleCrudSection
        entity={msg("Coupon")}
        queryKey={["coupons", "admin"]}
        url="/coupons"
        searchPlaceholder={msg("Search coupons")}
        filters={{ isActive: "" }}
        toolbarExtra={(filters, setFilter) => (
          <select className="form-select form-select-sm w-auto" aria-label={t("Status")} value={filters.isActive} onChange={(event) => setFilter("isActive", event.target.value)}>
            <option value="">{t("Any status")}</option>
            <option value="true">{t("Active")}</option>
            <option value="false">{t("Inactive")}</option>
          </select>
        )}
        fields={fields}
        columns={COLUMNS}
        toForm={toForm}
        fromForm={fromForm}
        empty={{ icon: "ticket-perforated", title: t("No coupons yet"), message: t("Add a code to offer shoppers a discount.") }}
      />
    </>
  );
}
