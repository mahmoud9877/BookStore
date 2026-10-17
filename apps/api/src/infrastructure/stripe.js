import Stripe from "stripe";
import { env } from "../config/env.js";

let stripeClient;

export const isStripeConfigured = () => Boolean(env.stripe.secretKey);

export function getStripe() {
  if (!isStripeConfigured()) {
    throw new Error("Card payments are not configured", { cause: 503 });
  }
  stripeClient ??= new Stripe(env.stripe.secretKey);
  return stripeClient;
}

export function createCheckoutSession({
  payment_method_types = ["card"],
  mode = "payment",
  customer_email,
  metadata = {},
  cancel_url = `${env.frontendUrl}/#/cart`,
  success_url = `${env.frontendUrl}/#/cart`,
  line_items = [],
} = {}) {
  return getStripe().checkout.sessions.create({
    payment_method_types,
    mode,
    customer_email,
    metadata,
    cancel_url,
    success_url,
    line_items,
  });
}

/** Verifies a webhook payload; throws if the signature is invalid. */
export function constructWebhookEvent(rawBody, signature) {
  if (!env.stripe.webhookSecret) {
    throw new Error("Stripe webhook is not configured", { cause: 503 });
  }
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    env.stripe.webhookSecret
  );
}
