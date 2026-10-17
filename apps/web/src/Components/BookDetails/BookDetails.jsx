import axios from "axios";
import { Helmet } from "react-helmet";
import { baseURL } from "../../index.js";
import { useParams } from "react-router-dom";
import React, { useState, useEffect } from "react";

const BookDetails = () => {
  const { bookId } = useParams(); // Get the book ID from the URL
  const [book, setBook] = useState(null); // State to store the book details
  const [loading, setLoading] = useState(true); // State to manage loading
  const [error, setError] = useState(null); // State to manage errors

  // Fetch book details from the backend
  useEffect(() => {
    const fetchBookDetails = async () => {
      try {
        const response = await axios.get(`${baseURL}/book/${bookId}`); // API call
        setBook(response.data.book); // Assuming the book data is under "book"
        setLoading(false); // Turn off loading after fetching
      } catch (err) {
        setError("Failed to fetch book details.");
        setLoading(false);
      }
    };
    if (bookId) {
      fetchBookDetails();
    }
  }, [bookId]);

  if (loading) return <div>Loading...</div>; // Loading state
  if (error) return <div className="alert alert-danger">{error}</div>; // Error state

  return (
    <div className="container mt-5">
      {/* Helmet should be inside the JSX */}
      <Helmet>
        <meta charSet="utf-8" />
        <title>{book ? book.bookTitle : "Book Details"}</title>
        <link rel="canonical" href={`http://mysite.com/book/${bookId}`} />
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
                  <small className="text-muted">
                    Category: {book.category}
                  </small>
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
};

export default BookDetails;
