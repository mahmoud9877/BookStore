import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import useBooks from "./useBooks.js";
import { addToCart } from "../cart/cart.service.js";
import { getErrorMessage } from "../../lib/api-client.js";

export default function HomePage() {
  const { books, isLoading, error } = useBooks();

  async function handleAddToCart(bookId) {
    try {
      await addToCart(bookId);
      alert("Book added to cart!");
    } catch (err) {
      alert(getErrorMessage(err, "Failed to add book to cart. Please try again."));
    }
  }

  return (
    <>
      <Helmet>
        <title>Home Page</title>
      </Helmet>

      <section id="book-carousel" className="py-5 bg-light">
        <div className="container">
          <h2 className="text-center mb-5">Featured Books</h2>
          {isLoading && <p className="text-center">Loading books...</p>}
          {error && <p className="alert alert-danger text-center">{error}</p>}
          {!isLoading && !error && books.length === 0 && (
            <p className="text-center">No books available.</p>
          )}
          <div className="row">
            {books.map((book) => (
              <div className="col-md-4 mb-4" key={book._id}>
                <div className="card h-100">
                  {book.image && (
                    <img src={book.image} className="card-img-top" alt={book.bookTitle} />
                  )}
                  <div className="card-body">
                    <h2 className="card-title">{book.bookTitle}</h2>
                    <button
                      onClick={() => handleAddToCart(book._id)}
                      className="btn btn-primary w-100"
                    >
                      Add to Cart
                    </button>
                    <Link to={`/book/${book._id}`} className="btn btn-secondary w-100">
                      View Book
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
