import { Helmet } from "react-helmet";
import React, { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StockNote, { LOW_STOCK_THRESHOLD } from "./StockNote.jsx";
import { getBook } from "./book.service.js";
import useAddToCart from "./useAddToCart.js";
import Spinner from "../../components/ui/Spinner.jsx";
import useAsyncData from "../../hooks/useAsyncData.js";
import BookCover from "../../components/ui/BookCover.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import { formatName, formatPrice, formatTitle } from "../../lib/format.js";

function QuantityStepper({ value, max, onChange }) {
  return (
    <div className="quantity-stepper" role="group" aria-label="Quantity">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity">
        <i className="bi bi-dash" aria-hidden="true"></i>
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <i className="bi bi-plus" aria-hidden="true"></i>
      </button>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="row g-4 g-lg-5" aria-busy="true" aria-label="Loading book">
      <div className="col-md-5 col-lg-4">
        <div className="skeleton" style={{ aspectRatio: "2 / 3", maxWidth: 360 }}></div>
      </div>
      <div className="col-md-7 col-lg-8">
        <div className="skeleton mb-3" style={{ height: 36, width: "70%" }}></div>
        <div className="skeleton mb-4" style={{ height: 18, width: "40%" }}></div>
        <div className="skeleton mb-2" style={{ height: 14 }}></div>
        <div className="skeleton" style={{ height: 14, width: "90%" }}></div>
      </div>
    </div>
  );
}

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const loadBook = useCallback(() => getBook(bookId), [bookId]);
  const { data: book, isLoading, error, reload } = useAsyncData(loadBook, {
    errorMessage: "We couldn't load this book.",
  });
  const { addToCart, pendingId } = useAddToCart();
  const [quantity, setQuantity] = useState(1);

  const title = book ? formatTitle(book.bookTitle) : "Book";
  const isSoldOut = book?.quantity <= 0;

  return (
    <div className="container py-4">
      <Helmet>
        <title>{`${title} · BookSaw`}</title>
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item">
            <Link to="/">Books</Link>
          </li>
          {book && (
            <li className="breadcrumb-item">
              <Link to={`/?category=${encodeURIComponent(book.category)}`} className="text-capitalize">
                {book.category}
              </Link>
            </li>
          )}
          <li className="breadcrumb-item active" aria-current="page">
            {title}
          </li>
        </ol>
      </nav>

      {isLoading ? (
        <DetailsSkeleton />
      ) : error || !book ? (
        <ErrorState message={error || "This book could not be found."} onRetry={error ? reload : undefined} />
      ) : (
        <div className="row g-4 g-lg-5">
          <div className="col-md-5 col-lg-4">
            <BookCover src={book.image} alt={`Cover of ${title}`} className="details-cover" />
          </div>
          <div className="col-md-7 col-lg-8">
            <span className="badge badge-soft mb-2">{book.category}</span>
            <h1 className="mb-1">{title}</h1>
            <p className="text-muted fs-5 mb-4">by {formatName(book.author)}</p>

            <div className="d-flex align-items-baseline gap-3 mb-3">
              <span className="price fs-3">{formatPrice(book.price)}</span>
              {book.quantity <= LOW_STOCK_THRESHOLD ? (
                <StockNote quantity={book.quantity} />
              ) : (
                <span className="stock-note text-success">In stock</span>
              )}
            </div>

            {!isSoldOut && (
              <div className="d-flex flex-wrap gap-3 align-items-center mb-4">
                <QuantityStepper
                  value={quantity}
                  max={book.quantity}
                  onChange={(next) => setQuantity(Math.min(Math.max(next, 1), book.quantity))}
                />
                <button
                  type="button"
                  className="btn btn-primary px-4"
                  onClick={() => addToCart(book, quantity)}
                  disabled={pendingId === book._id}
                >
                  {pendingId === book._id ? (
                    <Spinner label="Adding" />
                  ) : (
                    <>
                      <i className="bi bi-bag-plus me-2" aria-hidden="true"></i>Add to cart
                    </>
                  )}
                </button>
              </div>
            )}

            <h2 className="h5 mt-4">About this book</h2>
            <p className="text-muted" style={{ maxWidth: "65ch", whiteSpace: "pre-line" }}>
              {book.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
