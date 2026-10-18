import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import React, { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  selectCartCount,
  selectCartIsLoading,
  selectCartSubtotal,
  useCartStore,
} from "./cart.store.js";
import OrderForm from "./OrderForm.jsx";
import CartLineItem from "./CartLineItem.jsx";
import { createOrder } from "../orders/order.service.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import { formatPrice, formatTitle, pluralize } from "../../lib/format.js";

function OrderPlaced({ order }) {
  return (
    <StatePanel
      icon="check2-circle"
      title="Thank you — your order is placed!"
      message={`Order reference ${String(order._id).slice(-8).toUpperCase()}. You'll pay ${formatPrice(
        order.finalPrice
      )} in cash on delivery.`}
      action={
        <Link to="/" className="btn btn-primary">
          Continue shopping
        </Link>
      }
    />
  );
}

export default function CartPage() {
  const cart = useCartStore(
    useShallow((state) => ({
      items: state.items,
      error: state.error,
      count: selectCartCount(state),
      subtotal: selectCartSubtotal(state),
      isLoading: selectCartIsLoading(state),
      reload: state.load,
      remove: state.remove,
      clear: state.clear,
      markEmpty: state.markEmpty,
    }))
  );
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [placedOrder, setPlacedOrder] = useState(null);

  async function handlePlaceOrder(details) {
    setIsPlacingOrder(true);
    try {
      const { url, order } = await createOrder(details);
      if (url) {
        toast.info("Redirecting to secure payment…");
        window.location.href = url; // continue to the payment provider
        return;
      }
      cart.markEmpty();
      setPlacedOrder(order);
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't place your order. Please try again."));
    } finally {
      setIsPlacingOrder(false);
    }
  }

  async function handleRemove(item) {
    setRemovingId(item.bookId);
    try {
      await cart.remove(item.bookId);
      toast.success(`Removed “${formatTitle(item.bookTitle)}” from your cart.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't remove this book."));
    } finally {
      setRemovingId(null);
    }
  }

  async function handleClear() {
    const confirmed = await confirm({
      title: "Empty your cart?",
      message: `This removes all ${pluralize(cart.count, "book")} from your cart.`,
      confirmLabel: "Empty cart",
    });
    if (!confirmed) return;
    try {
      await cart.clear();
      toast.success("Your cart is empty.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't empty your cart."));
    }
  }

  return (
    <div className="container">
      <Helmet>
        <title>Your cart · BookSaw</title>
      </Helmet>
      <header className="page-header">
        <h1>Your cart</h1>
      </header>

      {placedOrder ? (
        <OrderPlaced order={placedOrder} />
      ) : cart.isLoading ? (
        <p className="text-muted" aria-busy="true">
          Loading your cart…
        </p>
      ) : cart.error ? (
        <ErrorState message={cart.error} onRetry={cart.reload} />
      ) : cart.items.length === 0 ? (
        <StatePanel
          icon="bag"
          title="Your cart is empty"
          message="Books you add will appear here."
          action={
            <Link to="/" className="btn btn-primary">
              Browse books
            </Link>
          }
        />
      ) : (
        <div className="row g-4">
          <section className="col-lg-7" aria-label="Items in your cart">
            <div className="card">
              <div className="card-body px-4">
                <ul className="list-unstyled mb-0">
                  {cart.items.map((item) => (
                    <CartLineItem
                      key={item.bookId}
                      item={item}
                      onRemove={handleRemove}
                      isRemoving={removingId === item.bookId}
                    />
                  ))}
                </ul>
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-ghost-danger mt-2" onClick={handleClear}>
              Empty cart
            </button>
          </section>

          <aside className="col-lg-5" aria-label="Order summary">
            <div className="card summary-card">
              <div className="card-body p-4">
                {isCheckingOut ? (
                  <OrderForm
                    total={cart.subtotal}
                    isSubmitting={isPlacingOrder}
                    onSubmit={handlePlaceOrder}
                    onCancel={() => setIsCheckingOut(false)}
                  />
                ) : (
                  <>
                    <h2 className="h5 mb-3">Order summary</h2>
                    <div className="summary-row">
                      <span className="text-muted">Items ({cart.count})</span>
                      <span>{formatPrice(cart.subtotal)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="text-muted">Delivery</span>
                      <span>Free</span>
                    </div>
                    <div className="summary-row summary-total">
                      <span>Total</span>
                      <span>{formatPrice(cart.subtotal)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary w-100 py-2 mt-3"
                      onClick={() => setIsCheckingOut(true)}
                    >
                      Checkout
                    </button>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
