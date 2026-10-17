import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { getBook } from "./book.service.js";

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    getBook(bookId)
      .then((result) => isCurrent && setBook(result))
      .catch(() => isCurrent && setError("Failed to fetch book details."))
      .finally(() => isCurrent && setIsLoading(false));
    return () => {
      isCurrent = false;
    };
  }, [bookId]);

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
