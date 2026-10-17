import axios from "axios";
import { baseURL, bearerKey } from "../../index.js";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import React, { useEffect, useState } from "react";
import "./Cart.css"; // Import custom styling

export default function Cart({ userData }) {
  const [books, setBooks] = useState([]); // Books in cart
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error message
  const [orderStatus, setOrderStatus] = useState(null); // Order status
  const [deleteStatus, setDeleteStatus] = useState(null); // Deletion status
  const [showOrderForm, setShowOrderForm] = useState(false); // Toggle for order form
  const [address, setAddress] = useState(""); // Delivery address
  const [phone, setPhone] = useState(""); // Phone number
  const [note, setNote] = useState(""); // Additional order note
  const [paymentType, setPaymentType] = useState("card"); // Payment method

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await axios.get(`${baseURL}/cart`, {
          headers: {
            authorization: `${bearerKey}${userData.token}`,
          },
        });
        if (response.data.cart && response.data.cart.books) {
          setBooks(response.data.cart.books);
        } else {
          setError("No books found in the cart.");
        }
      } catch (error) {
        setError("Failed to load cart.");
      } finally {
        setLoading(false);
      }
    };

    if (userData?.token) {
      fetchCart();
    }
    // console.log(userData);
  }, [userData?.token]); // Add token as dependency to refetch when it changes

  const handleMakeOrder = async () => {
    try {
      const response = await axios.post(
        `${baseURL}/order`,
        { address, phone, note, paymentType },
        {
          headers: {
            authorization: `${bearerKey}${userData.token}`,
          },
        }
      );

      const { url } = response.data;
      if (url) {
        window.location.href = url;
      } else {
        setOrderStatus("Order created but checkout URL is missing.");
      }
    } catch (error) {
      setOrderStatus("Failed to create order.");
    }
  };

  const handleDeleteBook = async (bookId) => {
    try {
      await axios.delete(`${baseURL}/cart/${bookId}`, {
        headers: {
          authorization: `${bearerKey} ${userData.token}`,
        },
      });
      setBooks(books.filter((book) => book.bookId !== bookId));
      setDeleteStatus("Book removed from cart.");
    } catch (error) {
      setDeleteStatus("Failed to delete book.");
    }
  };

  const handleClearCart = async () => {
    try {
      await axios.delete(`${baseURL}/cart/clear`, {
        headers: {
          authorization: `${bearerKey} ${userData.token}`,
        },
      });
      setBooks([]);
      setDeleteStatus("Cart cleared successfully.");
    } catch (error) {
      setDeleteStatus("Failed to clear cart.");
    }
  };

  if (loading) return <p>Loading books...</p>;
  if (error) return <p className="alert alert-danger">{error}</p>;

  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        <title>Cart</title>
        <link rel="canonical" href="http://mysite.com/example" />
      </Helmet>
      <div className="cart-container">
        <h2 className="cart-title">Your Cart</h2>
        <div className="row g-4 py-3">
          {books.length > 0 ? (
            books.map((book) => (
              <div key={book.bookId} className="col-lg-4 col-md-6 col-sm-12">
                <div className="card shadow-sm cart-card">
                  <div className="card-body d-flex flex-column align-items-center">
                    <img
                      src={book.image || "default-image-url.jpg"}
                      alt={book.bookTitle || "Unknown Title"}
                      className="book-image mb-3"
                    />
                    <h5 className="card-title text-center mb-2">
                      {book.bookTitle || "Unknown Title"}
                    </h5>
                    <p className="card-text text-center mb-2">
                      <strong>Price: </strong>${book.price || "N/A"}
                    </p>
                    <p className="card-text text-center mb-3">
                      <strong>Quantity: </strong>
                      {book.quantity}
                    </p>
                    <div className="cart-buttons w-100">
                      <Link
                        to={`/book/${book.bookId}`}
                        className="btn btn-primary w-100 mb-2"
                      >
                        View Book
                      </Link>
                      <button
                        className="btn btn-danger w-100"
                        onClick={() => handleDeleteBook(book.bookId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-cart-text">Your cart is empty.</p>
          )}
        </div>

        {books.length > 0 && (
          <div className="cart-actions">
            {!showOrderForm ? (
              <button
                className="btn btn-success mt-3"
                onClick={() => setShowOrderForm(true)}
              >
                Place Order
              </button>
            ) : (
              <div className="order-form">
                <h4>Enter your details:</h4>
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Enter your address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <input
                  type="tel"
                  className="form-control mb-3"
                  placeholder="Enter your phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <textarea
                  className="form-control mb-3"
                  placeholder="Add special instructions"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <select
                  className="form-select mb-3"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                </select>
                <button className="btn btn-success" onClick={handleMakeOrder}>
                  Confirm Order
                </button>
              </div>
            )}
            <button
              className="btn btn-warning mt-3 ms-3"
              onClick={handleClearCart}
            >
              Clear Cart
            </button>
          </div>
        )}

        {orderStatus && <p className="alert alert-info mt-3">{orderStatus}</p>}
        {deleteStatus && (
          <p className="alert alert-warning mt-3">{deleteStatus}</p>
        )}
      </div>
    </>
  );
}
