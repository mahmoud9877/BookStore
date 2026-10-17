import Stripe from "stripe";
import { BadRequestError, ServiceUnavailableError } from "../core/http-errors.js";

export class StripePaymentGateway {
  #secretKey;
  #webhookSecret;
  #frontendUrl;
  #client;

  constructor({ secretKey, webhookSecret, frontendUrl } = {}) {
    this.#secretKey = secretKey;
    this.#webhookSecret = webhookSecret;
    this.#frontendUrl = frontendUrl;
  }

  get isConfigured() {
    return Boolean(this.#secretKey);
  }

  #stripe() {
    if (!this.isConfigured) {
      throw new ServiceUnavailableError("Card payments are not configured");
    }
    this.#client ??= new Stripe(this.#secretKey);
    return this.#client;
  }

  createCheckoutSession({ customerEmail, metadata = {}, lineItems = [] }) {
    return this.#stripe().checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      metadata,
      cancel_url: `${this.#frontendUrl}/#/cart`,
      success_url: `${this.#frontendUrl}/#/cart`,
      line_items: lineItems,
    });
  }

  /** Verifies a webhook payload; an invalid signature throws BadRequestError. */
  constructWebhookEvent(rawBody, signature) {
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
}
