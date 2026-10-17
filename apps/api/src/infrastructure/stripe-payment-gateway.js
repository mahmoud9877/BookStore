import Stripe from "stripe";
import { PAYMENT_OUTCOMES } from "../modules/orders/payment-gateway.js";
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

  constructor({ secretKey, webhookSecret, frontendUrl, currency = "egp" } = {}) {
    this.#secretKey = secretKey;
    this.#webhookSecret = webhookSecret;
    this.#frontendUrl = frontendUrl;
    this.#currency = currency;
  }

  get isConfigured() {
    return Boolean(this.#secretKey);
  }

  async createCheckout({ orderId, customerEmail, items }) {
    const session = await this.#stripe().checkout.sessions.create({
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
    });
    return { id: session.id, url: session.url };
  }

  /** Verifies the signature and translates the Stripe event into a payment outcome. */
  parseWebhookEvent(rawBody, signature) {
    const event = this.#verify(rawBody, signature);
    return {
      outcome: OUTCOME_BY_EVENT_TYPE[event.type] ?? PAYMENT_OUTCOMES.ignored,
      orderId: event.data?.object?.metadata?.orderId,
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
    this.#client ??= new Stripe(this.#secretKey);
    return this.#client;
  }
}
