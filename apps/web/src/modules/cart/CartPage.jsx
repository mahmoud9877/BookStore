import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import React, { useState } from "react";
import { usePlaceOrder } from "../orders/order.queries.js";
import { countItems, subtotalOf, useCartQuery, useClearCart, useRemoveCartItem } from "./cart.queries.js";
import OrderForm from "./OrderForm.jsx";
import CartLineItem from "./CartLineItem.jsx";
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
        <Link to="/catalog" className="btn btn-primary">
          Continue shopping
        </Link>
      }
    />
  );
}

const NO_ITEMS = [];

export default function CartPage() {
  const { data: items = NO_ITEMS, isLoading, error, refetch } = useCartQuery();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const placeOrder = usePlaceOrder();
  const count = countItems(items);
  const subtotal = subtotalOf(items);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  async function handlePlaceOrder(details) {
    try {
      const { url, order } = await placeOrder.mutateAsync(details);
      if (url) {
        toast.info("Redirecting to secure payment…");
        window.location.href = url; // continue to the payment provider
        return;
      }
      setPlacedOrder(order);
    } catch (err) {
      toast.error(getErrorMessage(err, "We couldn't place your order. Please try again."));
    }
  }

  async function handleRemove(item) {
    try {
      await removeItem.mutateAsync(item.bookId);
      toast.success(`Removed “${formatTitle(item.bookTitle)}” from your cart.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't remove this book."));
    }
  }

  async function handleClear() {
    const confirmed = await confirm({
      title: "Empty your cart?",
      message: `This removes all ${pluralize(count, "book")} from your cart.`,
      confirmLabel: "Empty cart",
    });
    if (!confirmed) return;
    try {
      await clearCart.mutateAsync();
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
      ) : isLoading ? (
        <p className="text-muted" aria-busy="true">
          Loading your cart…
        </p>
      ) : error ? (
        <ErrorState message={getErrorMessage(error, "We couldn't load your cart.")} onRetry={refetch} />
      ) : items.length === 0 ? (
        <StatePanel
          icon="bag"
          title="Your cart is empty"
          message="Books you add will appear here."
          action={
            <Link to="/catalog" className="btn btn-primary">
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
                  {items.map((item) => (
                    <CartLineItem
                      key={item.bookId}
                      item={item}
                      onRemove={handleRemove}
                      isRemoving={removeItem.isPending && removeItem.variables === item.bookId}
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
                    total={subtotal}
                    isSubmitting={placeOrder.isPending}
                    onSubmit={handlePlaceOrder}
                    onCancel={() => setIsCheckingOut(false)}
                  />
                ) : (
                  <>
                    <h2 className="h5 mb-3">Order summary</h2>
                    <div className="summary-row">
                      <span className="text-muted">Items ({count})</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="text-muted">Delivery</span>
                      <span>Free</span>
                    </div>
                    <div className="summary-row summary-total">
                      <span>Total</span>
                      <span>{formatPrice(subtotal)}</span>
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
