import React from "react";
import { t } from "../../i18n/index.js";

export const LOW_STOCK_THRESHOLD = 5;

/** "Out of stock" / "Only 3 left" / nothing when plenty is available. */
export default function StockNote({ quantity, className = "" }) {
  if (quantity <= 0) return <span className={`stock-note text-danger ${className}`}>{t("Out of stock")}</span>;
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return <span className={`stock-note text-warning-emphasis ${className}`}>{t("Only {quantity} left", { quantity })}</span>;
  }
  return null;
}
