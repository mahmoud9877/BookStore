import Stripe from "stripe";
import { PAYMENT_OUTCOMES } from "../modules/orders/providers/payment-gateway.js";
import { BadRequestError, ServiceUnavailableError } from "../core/http-errors.js";

const OUTCOME_BY_EVENT_TYPE = {
  "checkout.session.completed": PAYMENT_OUTCOMES.paid,
  "checkout.session.expired": PAYMENT_OUTCOMES.failed,
  "checkout.session.async_payment_failed": PAYMENT_OUTCOMES.failed,
};

/** Payment gateway adapter for Stripe Checkout (see modules/orders/payment-gateway.js). */
export class StripePaymentGateway {
  #secretKey;
  #webhookSecret;
  #frontendUrl;
  #currency;
  #client;

  /** `client` replaces the Stripe SDK client (tests). */
  constructor({ secretKey, webhookSecret, frontendUrl, currency = "egp", client } = {}) {
    this.#secretKey = secretKey;
    this.#client = client;
    this.#webhookSecret = webhookSecret;
    this.#frontendUrl = frontendUrl;
    this.#currency = currency;
  }

  get isConfigured() {
    return Boolean(this.#secretKey);
  }

  async createCheckout({ orderId, customerEmail, items, discount = null }) {
    const stripe = this.#stripe();
    const discounts = discount?.amount > 0 ? [{ coupon: (await this.#oneOffCoupon(stripe, discount)).id }] : undefined;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      metadata: { orderId },
      cancel_url: `${this.#frontendUrl}/#/cart`,
      success_url: `${this.#frontendUrl}/#/cart`,
      line_items: items.map((item) => ({
        price_data: {
          currency: this.#currency,
          product_data: { name: item.name || "Unknown Book" },
          unit_amount: Math.round(item.unitPrice * 100), // Stripe expects minor units
        },
        quantity: item.quantity,
      })),
      discounts,
    });
    return { id: session.id, url: session.url };
  }

  /** A single-use Stripe coupon worth exactly the order's discount, so Stripe charges the order's final price. */
  #oneOffCoupon(stripe, { amount, name }) {
    return stripe.coupons.create({
      amount_off: Math.round(amount * 100), // minor units
      currency: this.#currency,
      duration: "once",
      max_redemptions: 1,
      ...(name ? { name: String(name).slice(0, 40) } : {}),
    });
  }

  /**
   * A one-off payment of `amount` minor units (library fines). `metadata` comes
   * back on the webhook event; `returnPath` is the web app route to return to.
   */
  async createPaymentCheckout({ reference, description, amount, currency, customerEmail, metadata, returnPath }) {
    const returnUrl = `${this.#frontendUrl}/#${returnPath}`;
    const session = await this.#stripe().checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customerEmail || undefined,
        client_reference_id: reference,
        metadata,
        payment_intent_data: { metadata },
        success_url: returnUrl,
        cancel_url: returnUrl,
        line_items: [
          {
            price_data: { currency: currency.toLowerCase(), product_data: { name: description }, unit_amount: amount },
            quantity: 1,
          },
        ],
      },
      // Stripe deduplicates retried requests with the same key.
      { idempotencyKey: `checkout:${reference}` }
    );
    return { id: session.id, url: session.url };
  }

  /** Refunds `amount` minor units of a captured payment; resolves `{ id }`. */
  async refund({ paymentRef, amount, reference }) {
    const refund = await this.#stripe().refunds.create(
      { payment_intent: paymentRef, amount },
      { idempotencyKey: `refund:${reference}` }
    );
    return { id: refund.id };
  }

  /** Verifies the signature and translates the Stripe event into a payment outcome. */
  parseWebhookEvent(rawBody, signature) {
    const event = this.#verify(rawBody, signature);
    const object = event.data?.object ?? {};
    return {
      eventId: event.id,
      outcome: OUTCOME_BY_EVENT_TYPE[event.type] ?? PAYMENT_OUTCOMES.ignored,
      orderId: object.metadata?.orderId,
      metadata: object.metadata ?? {},
      paymentRef: typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id,
    };
  }

  #verify(rawBody, signature) {
    if (!this.#webhookSecret) {
      throw new ServiceUnavailableError("Stripe webhook is not configured");
    }
    try {
      return this.#stripe().webhooks.constructEvent(rawBody, signature, this.#webhookSecret);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error;
      throw new BadRequestError(`Webhook Error: ${error.message}`);
    }
  }

  #stripe() {
    if (!this.isConfigured) {
      throw new ServiceUnavailableError("Card payments are not configured");
    }
    // Bounded network time and automatic retries for transient failures.
    this.#client ??= new Stripe(this.#secretKey, { timeout: 20_000, maxNetworkRetries: 2 });
    return this.#client;
  }
}
