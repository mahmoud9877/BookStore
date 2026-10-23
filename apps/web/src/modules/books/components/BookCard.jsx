import React from "react";
import { Link } from "react-router-dom";
import StockNote from "./StockNote.jsx";
import { availabilityLabel } from "../utils/catalogue.js";
import Spinner from "../../../components/ui/Spinner.jsx";
import BookCover from "../../../components/ui/BookCover.jsx";
import { BookPrice } from "./Price.jsx";
import { formatName, formatTitle } from "../../../lib/format.js";
import { t } from "../../../i18n/index.js";

/** Lending availability under a title: green when a copy is on a shelf. */
export function AvailabilityNote({ availability, className = "" }) {
  const label = availabilityLabel(availability);
  if (!label) return null;
  const available = availability.available > 0;
  return (
    <span className={`small d-inline-flex align-items-center gap-1 ${available ? "text-success" : "text-muted"} ${className}`}>
      <i className={`bi bi-${available ? "check-circle" : "hourglass-split"}`} aria-hidden="true"></i>
      {label}
    </span>
  );
}

export default function BookCard({ book, onAddToCart, isAdding, badge }) {
  const title = formatTitle(book.bookTitle);
  const isSoldOut = book.quantity <= 0;
  const forSale = book.isForSale !== false;

  return (
    <article className="book-card">
      <Link to={`/book/${book._id}`} tabIndex={-1} aria-hidden="true">
        <BookCover src={book.image} alt="" />
      </Link>
      <div className="card-body">
        {badge && <span className="badge badge-soft align-self-start mb-1">{badge}</span>}
        <h3 className="book-title">
          <Link to={`/book/${book._id}`}>{title}</Link>
        </h3>
        <p className="book-author">{formatName(book.author)}</p>
        <AvailabilityNote availability={book.availability} />
        {forSale && onAddToCart && (
          <>
            <div className="d-flex flex-wrap align-items-baseline justify-content-between column-gap-2 mt-auto pt-2">
              <BookPrice book={book} />
              <StockNote quantity={book.quantity} />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm w-100 mt-2"
              onClick={() => onAddToCart(book)}
              disabled={isSoldOut || isAdding}
              aria-label={t("Add {title} to cart", { title })}
            >
              {isAdding ? <Spinner label={t("Adding")} /> : isSoldOut ? t("Sold out") : (
                <>
                  <i className="bi bi-bag-plus me-1" aria-hidden="true"></i>{t("Add to cart")}
                </>
              )}
            </button>
          </>
        )}
        {!forSale && (
          <Link to={`/book/${book._id}`} className="btn btn-outline-primary btn-sm w-100 mt-auto">
            {t("Borrow or reserve")}
          </Link>
        )}
      </div>
    </article>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="book-card" aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: "2 / 3" }}></div>
      <div className="card-body">
        <div className="skeleton" style={{ height: 18, width: "85%" }}></div>
        <div className="skeleton" style={{ height: 14, width: "55%" }}></div>
        <div className="skeleton mt-3" style={{ height: 31 }}></div>
      </div>
    </div>
  );
}
