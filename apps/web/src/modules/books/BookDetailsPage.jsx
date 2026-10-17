import { Helmet } from "react-helmet";
import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { getBook } from "./book.service.js";
import useAsyncData from "../../hooks/useAsyncData.js";

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const loadBook = useCallback(() => getBook(bookId), [bookId]);
  const { data: book, isLoading, error } = useAsyncData(loadBook, {
    errorMessage: "Failed to fetch book details.",
  });

  if (isLoading) return <div className="container mt-5">Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-5">
      <Helmet>
        <title>{book ? book.bookTitle : "Book Details"}</title>
      </Helmet>

      {book ? (
        <div className="card shadow-sm">
          <div className="row g-0">
            <div className="col-md-4">
              <img
                src={book.image}
                alt={book.bookTitle}
                className="img-fluid rounded-start"
                style={{ height: "100%", objectFit: "cover" }}
              />
            </div>
            <div className="col-md-8">
              <div className="card-body">
                <h2 className="card-title text-dark">{book.bookTitle}</h2>
                <p className="card-text text-muted">{book.description}</p>
                <p className="card-text">
                  <strong>Author:</strong> {book.author}
                </p>
                <p className="card-text">
                  <strong>Price:</strong> ${book.price}
                </p>
                <p className="card-text">
                  <small className="text-muted">Category: {book.category}</small>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-warning">Book not found.</div>
      )}
    </div>
  );
}
