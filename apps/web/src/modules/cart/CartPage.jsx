import { Helmet } from "react-helmet";
import React, { useState } from "react";
import OrderForm from "./OrderForm.jsx";
import CartItemCard from "./CartItemCard.jsx";
import useAsyncData from "../../hooks/useAsyncData.js";
import { createOrder } from "../orders/order.service.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { clearCart, getCartItems, removeFromCart } from "./cart.service.js";
import "./CartPage.css";

export default function CartPage() {
  const {
    data: items,
    setData: setItems,
    isLoading,
    error,
  } = useAsyncData(getCartItems, { initialData: [], errorMessage: "Failed to load cart." });
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState(null);

  async function handlePlaceOrder(details) {
    setIsPlacingOrder(true);
    setOrderStatus(null);
    try {
      const { url } = await createOrder(details);
      if (url) {
        window.location.href = url; // continue to the payment provider
        return;
      }
      setItems([]);
      setShowOrderForm(false);
      setOrderStatus("Order placed successfully.");
    } catch (err) {
      setOrderStatus(getErrorMessage(err, "Failed to create order."));
    } finally {
      setIsPlacingOrder(false);
    }
  }

  /** Runs a cart change and reports its outcome below the cart. */
  async function updateCart({ request, applyLocally, successMessage, failureMessage }) {
    try {
      await request();
      applyLocally();
      setDeleteStatus(successMessage);
    } catch (err) {
      setDeleteStatus(getErrorMessage(err, failureMessage));
    }
  }

  const handleRemove = (bookId) =>
    updateCart({
      request: () => removeFromCart(bookId),
      applyLocally: () => setItems((current) => current.filter((item) => item.bookId !== bookId)),
      successMessage: "Book removed from cart.",
      failureMessage: "Failed to delete book.",
    });

  const handleClear = () =>
    updateCart({
      request: clearCart,
      applyLocally: () => setItems([]),
      successMessage: "Cart cleared successfully.",
      failureMessage: "Failed to clear cart.",
    });

  if (isLoading) return <p>Loading books...</p>;
  if (error) return <p className="alert alert-danger">{error}</p>;

  return (
    <>
      <Helmet>
        <title>Cart</title>
      </Helmet>
      <div className="cart-container">
        <h2 className="cart-title">Your Cart</h2>
        <div className="row g-4 py-3">
          {items.length > 0 ? (
            items.map((item) => <CartItemCard key={item.bookId} item={item} onRemove={handleRemove} />)
          ) : (
            <p className="empty-cart-text">Your cart is empty.</p>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-actions">
            {showOrderForm ? (
              <OrderForm isSubmitting={isPlacingOrder} onSubmit={handlePlaceOrder} />
            ) : (
              <button className="btn btn-success mt-3" onClick={() => setShowOrderForm(true)}>
                Place Order
              </button>
            )}
            <button className="btn btn-warning mt-3 ms-3" onClick={handleClear}>
              Clear Cart
            </button>
          </div>
        )}

        {orderStatus && <p className="alert alert-info mt-3">{orderStatus}</p>}
        {deleteStatus && <p className="alert alert-warning mt-3">{deleteStatus}</p>}
      </div>
    </>
  );
}
