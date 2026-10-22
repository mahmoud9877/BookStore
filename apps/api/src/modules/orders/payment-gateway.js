/**
 * The payment port OrderService depends on. Infrastructure adapters (e.g.
 * StripePaymentGateway) implement it, so the order domain never sees a
 * provider's request or event formats.
 *
 * Implementations provide:
 *   isConfigured: boolean
 *   createCheckout({ orderId, customerEmail, items: [{ name, unitPrice, quantity }] })
 *     -> Promise<{ id, url }>
 *   createPaymentCheckout({ reference, description, amount (minor units), currency,
 *     customerEmail, metadata, returnPath }) -> Promise<{ id, url }>   (library fines)
 *   refund({ paymentRef, amount (minor units), reference }) -> Promise<{ id }>
 *   parseWebhookEvent(rawBody, signature)
 *     -> { eventId, outcome: PAYMENT_OUTCOMES[*], orderId, metadata, paymentRef }
 *     (throws BadRequestError for an invalid signature)
 */
export const PAYMENT_OUTCOMES = Object.freeze({
  paid: "paid",
  failed: "failed",
  ignored: "ignored",
});
