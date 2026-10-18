import React from "react";
import { Link } from "react-router-dom";
import StockNote from "./StockNote.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import BookCover from "../../components/ui/BookCover.jsx";
import { formatName, formatPrice, formatTitle } from "../../lib/format.js";

export default function BookCard({ book, onAddToCart, isAdding }) {
  const title = formatTitle(book.bookTitle);
  const isSoldOut = book.quantity <= 0;

  return (
    <article className="book-card">
      <Link to={`/book/${book._id}`} tabIndex={-1} aria-hidden="true">
        <BookCover src={book.image} alt="" />
      </Link>
      <div className="card-body">
        <h3 className="book-title">
          <Link to={`/book/${book._id}`}>{title}</Link>
        </h3>
        <p className="book-author">{formatName(book.author)}</p>
        <div className="d-flex flex-wrap align-items-baseline justify-content-between column-gap-2 mt-auto pt-2">
          <span className="price">{formatPrice(book.price)}</span>
          <StockNote quantity={book.quantity} />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm w-100 mt-2"
          onClick={() => onAddToCart(book)}
          disabled={isSoldOut || isAdding}
          aria-label={`Add ${title} to cart`}
        >
          {isAdding ? <Spinner label="Adding" /> : isSoldOut ? "Sold out" : (
            <>
              <i className="bi bi-bag-plus me-1" aria-hidden="true"></i>Add to cart
            </>
          )}
        </button>
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
