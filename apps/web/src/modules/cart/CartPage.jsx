import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { createOrder } from "../orders/order.service.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { clearCart, getCartItems, removeFromCart } from "./cart.service.js";
import "./CartPage.css";

export default function CartPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paymentType, setPaymentType] = useState("card");

  useEffect(() => {
    getCartItems()
      .then(setBooks)
      .catch(() => setError("Failed to load cart."))
      .finally(() => setLoading(false));
  }, []);

  const handleMakeOrder = async () => {
    setIsPlacingOrder(true);
    setOrderStatus(null);
    try {
      const data = await createOrder({ address, phone, note, paymentType });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setBooks([]);
      setShowOrderForm(false);
      setOrderStatus("Order placed successfully.");
    } catch (err) {
      setOrderStatus(getErrorMessage(err, "Failed to create order."));
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleDeleteBook = async (bookId) => {
    try {
      await removeFromCart(bookId);
      setBooks((current) => current.filter((book) => book.bookId !== bookId));
      setDeleteStatus("Book removed from cart.");
    } catch (err) {
      setDeleteStatus(getErrorMessage(err, "Failed to delete book."));
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      setBooks([]);
      setDeleteStatus("Cart cleared successfully.");
    } catch (err) {
      setDeleteStatus(getErrorMessage(err, "Failed to clear cart."));
    }
  };

  if (loading) return <p>Loading books...</p>;
  if (error) return <p className="alert alert-danger">{error}</p>;

  return (
    <>
      <Helmet>
        <title>Cart</title>
      </Helmet>
      <div className="cart-container">
        <h2 className="cart-title">Your Cart</h2>
        <div className="row g-4 py-3">
          {books.length > 0 ? (
            books.map((book) => (
              <div key={book.bookId} className="col-lg-4 col-md-6 col-sm-12">
                <div className="card shadow-sm cart-card">
                  <div className="card-body d-flex flex-column align-items-center">
                    {book.image && (
                      <img
                        src={book.image}
                        alt={book.bookTitle || "Unknown Title"}
                        className="book-image mb-3"
                      />
                    )}
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
                  aria-label="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <input
                  type="tel"
                  className="form-control mb-3"
                  placeholder="Enter your phone"
                  aria-label="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <textarea
                  className="form-control mb-3"
                  placeholder="Add special instructions"
                  aria-label="Order note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <select
                  className="form-select mb-3"
                  aria-label="Payment method"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                </select>
                <button
                  className="btn btn-success"
                  onClick={handleMakeOrder}
                  disabled={isPlacingOrder || !address.trim() || !phone.trim()}
                >
                  {isPlacingOrder ? "Placing Order..." : "Confirm Order"}
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
