/**
 * The payment port OrderService depends on. Infrastructure adapters (e.g.
 * StripePaymentGateway) implement it, so the order domain never sees a
 * provider's request or event formats.
 *
 * Implementations provide:
 *   isConfigured: boolean
 *   createCheckout({ orderId, customerEmail, items: [{ name, unitPrice, quantity }] })
 *     -> Promise<{ id, url }>
 *   parseWebhookEvent(rawBody, signature) -> { outcome: PAYMENT_OUTCOMES[*], orderId }
 *     (throws BadRequestError for an invalid signature)
 */
export const PAYMENT_OUTCOMES = Object.freeze({
  paid: "paid",
  failed: "failed",
  ignored: "ignored",
});
