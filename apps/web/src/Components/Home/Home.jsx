import { Helmet } from "react-helmet";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import useRoute from "../../Hooks/useRoute.js";

export default function Home({ userData }) {
  const { books, handleAddToCart } = useRoute(userData); // Use the custom hook


  return (
    <>
      {/* Helmet for SEO */}
      <Helmet>
        <meta charSet="utf-8" />
        <title>Home Page</title>
        <link rel="canonical" href="http://mysite.com/example" />
      </Helmet>
 

      {/* Dynamic Home Page Content */}
      <section id="book-carousel" className="py-5 bg-light">
        <div className="container">
          <h2 className="text-center mb-5">Featured Books</h2>
          <div className="row">
            {books.length > 0 ? (
              books.map((bookItem) => (
                <div className="col-md-4 mb-4" key={bookItem._id}>
                  <div className="card h-100">
                    <img
                      src={bookItem.image || "https://via.placeholder.com/150"}
                      className="card-img-top"
                      alt={bookItem.bookTitle}
                    />
                    <div className="card-body">
                      <h2 className="card-title">{bookItem.bookTitle}</h2>
                      {/* <p className="card-text">{bookItem.description}</p> */}
                      <button
                        onClick={() => handleAddToCart(bookItem._id)}
                        className="btn btn-primary w-100"
                      >
                        Add to Cart
                      </button>
                      <Link
                        to={`/book/${bookItem._id}`} // Corrected link for viewing the book
                        className="btn btn-secondary w-100"
                      >
                        View Book
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center">No books available.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
