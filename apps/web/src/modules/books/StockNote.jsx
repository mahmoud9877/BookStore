import React from "react";

export const LOW_STOCK_THRESHOLD = 5;

/** "Out of stock" / "Only 3 left" / nothing when plenty is available. */
export default function StockNote({ quantity, className = "" }) {
  if (quantity <= 0) return <span className={`stock-note text-danger ${className}`}>Out of stock</span>;
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return <span className={`stock-note text-warning-emphasis ${className}`}>Only {quantity} left</span>;
  }
  return null;
}
