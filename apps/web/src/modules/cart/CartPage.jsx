import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { usePlaceOrder } from "../orders/order.queries.js";
import { countItems, subtotalOf, useCartQuery, useClearCart, useRemoveCartItem } from "./cart.queries.js";
import OrderForm from "./OrderForm.jsx";
import CartLineItem from "./CartLineItem.jsx";
import CouponBox, { DiscountRow } from "./CouponBox.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { toast } from "../../components/ui/toast.store.js";
import { confirm } from "../../components/ui/confirm.store.js";
import StatePanel, { ErrorState } from "../../components/ui/StatePanel.jsx";
import { formatNumber, formatPrice, formatTitle, pluralize } from "../../lib/format.js";
import { t } from "../../i18n/index.js";

function OrderPlaced({ order }) {
  return (
    <StatePanel
      icon="check2-circle"
      title={t("Thank you — your order is placed!")}
      message={t("Order reference {reference}. You'll pay {amount} in cash on delivery.", {
        reference: String(order._id).slice(-8).toUpperCase(),
        amount: formatPrice(order.finalPrice),
      })}
      action={
        <Link to="/catalog" className="btn btn-primary">
          {t("Continue shopping")}
        </Link>
      }
    />
  );
}

const NO_ITEMS = [];

/** Changes whenever the cart's contents or prices change (an applied coupon is then dropped). */
const cartSignature = (items) => items.map((item) => `${item.bookId}:${item.quantity}:${item.price}`).join("|");

export default function CartPage() {
  const { data: items = NO_ITEMS, isLoading, error, refetch } = useCartQuery();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const placeOrder = usePlaceOrder();
  const count = countItems(items);
  const subtotal = subtotalOf(items);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  // The coupon checked against the cart as it was; any change to the cart clears it.
  const signature = cartSignature(items);
  const [coupon, setCoupon] = useState(null);
  const applied = coupon?.signature === signature ? coupon.result : null;
  useEffect(() => setCoupon((current) => (current && current.signature !== signature ? null : current)), [signature]);
  const total = applied ? applied.total : subtotal;

  async function handlePlaceOrder(details) {
    try {
      const { url, order } = await placeOrder.mutateAsync(applied ? { ...details, couponCode: applied.code } : details);
      if (url) {
        toast.info(t("Redirecting to secure payment…"));
        window.location.href = url; // continue to the payment provider
        return;
      }
      setPlacedOrder(order);
    } catch (err) {
      toast.error(getErrorMessage(err, t("We couldn't place your order. Please try again.")));
    }
  }

  async function handleRemove(item) {
    try {
      await removeItem.mutateAsync(item.bookId);
      toast.success(t("Removed “{title}” from your cart.", { title: formatTitle(item.bookTitle) }));
    } catch (err) {
      toast.error(getErrorMessage(err, t("Couldn't remove this book.")));
    }
  }

  async function handleClear() {
    const confirmed = await confirm({
      title: t("Empty your cart?"),
      message: t("This removes all {books} from your cart.", { books: pluralize(count, "book") }),
      confirmLabel: t("Empty cart"),
    });
    if (!confirmed) return;
    try {
      await clearCart.mutateAsync();
      toast.success(t("Your cart is empty."));
    } catch (err) {
      toast.error(getErrorMessage(err, t("Couldn't empty your cart.")));
    }
  }

  return (
    <div className="container">
      <Helmet>
        <title>{t("Your cart · BookSaw")}</title>
      </Helmet>
      <header className="page-header">
        <h1>{t("Your cart")}</h1>
      </header>

      {placedOrder ? (
        <OrderPlaced order={placedOrder} />
      ) : isLoading ? (
        <p className="text-muted" aria-busy="true">
          {t("Loading your cart…")}
        </p>
      ) : error ? (
        <ErrorState message={getErrorMessage(error, t("We couldn't load your cart."))} onRetry={refetch} />
      ) : items.length === 0 ? (
        <StatePanel
          icon="bag"
          title={t("Your cart is empty")}
          message={t("Books you add will appear here.")}
          action={
            <Link to="/catalog" className="btn btn-primary">
              {t("Browse books")}
            </Link>
          }
        />
      ) : (
        <div className="row g-4">
          <section className="col-lg-7" aria-label={t("Items in your cart")}>
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
              {t("Empty cart")}
            </button>
          </section>

          <aside className="col-lg-5" aria-label={t("Order summary")}>
            <div className="card summary-card">
              <div className="card-body p-4">
                {isCheckingOut ? (
                  <OrderForm
                    total={total}
                    coupon={applied}
                    onApplyCoupon={(result) => setCoupon({ signature, result })}
                    onRemoveCoupon={() => setCoupon(null)}
                    isSubmitting={placeOrder.isPending}
                    onSubmit={handlePlaceOrder}
                    onCancel={() => setIsCheckingOut(false)}
                  />
                ) : (
                  <>
                    <h2 className="h5 mb-3">{t("Order summary")}</h2>
                    <div className="summary-row">
                      <span className="text-muted">{t("Items ({count})", { count: formatNumber(count) })}</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="text-muted">{t("Delivery")}</span>
                      <span>{t("Free")}</span>
                    </div>
                    <CouponBox applied={applied} onApply={(result) => setCoupon({ signature, result })} onRemove={() => setCoupon(null)} />
                    {applied && <DiscountRow coupon={applied} />}
                    <div className="summary-row summary-total">
                      <span>{t("Total")}</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary w-100 py-2 mt-3"
                      onClick={() => setIsCheckingOut(true)}
                    >
                      {t("Checkout")}
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
