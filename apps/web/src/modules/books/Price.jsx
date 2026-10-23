import React from "react";
import { formatNumber, formatPrice } from "../../lib/format.js";
import { t } from "../../i18n/index.js";

/** Sale price, list price and discount of a book (see the API's BookResponseDto). */
export const bookPricing = (book) => {
  const percent = Number(book?.activeDiscountPercent) || 0;
  return percent > 0
    ? { amount: book.salePrice ?? book.price, original: book.price, percent }
    : { amount: book?.price, original: null, percent: 0 };
};

/**
 * A shop price. On sale (`original` above `amount`) it also shows the original
 * price struck through and a "−20%" badge; `percent` defaults to the rounded saving.
 */
export default function Price({ amount, original, percent, className = "" }) {
  const onSale = original != null && Number(original) > Number(amount);
  if (!onSale) return <span className={`price ${className}`}>{formatPrice(amount)}</span>;
  const saving = percent || Math.round((1 - Number(amount) / Number(original)) * 100);
  return (
    <span className={`price-sale ${className}`}>
      <span className="price">{formatPrice(amount)}</span>
      <del className="price-original">
        <span className="visually-hidden">{t("Original price")} </span>
        {formatPrice(original)}
      </del>
      {saving > 0 && <span className="badge price-badge">{`−${formatNumber(saving)}%`}</span>}
    </span>
  );
}

/** A book's price, with its active discount. */
export const BookPrice = ({ book, className }) => <Price {...bookPricing(book)} className={className} />;
