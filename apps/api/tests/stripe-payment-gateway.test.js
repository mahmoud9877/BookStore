import Stripe from "stripe";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PAYMENT_OUTCOMES } from "../src/modules/orders/payment-gateway.js";
import { StripePaymentGateway } from "../src/infrastructure/stripe-payment-gateway.js";

const webhookSecret = "whsec_unit_test";
const gateway = new StripePaymentGateway({ secretKey: "sk_test_unit", webhookSecret });
const signed = (event) => {
  const payload = JSON.stringify({ id: "evt_1", object: "event", ...event });
  return [payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret })];
};

describe("StripePaymentGateway.parseWebhookEvent", () => {
  test("translates Stripe event types into payment outcomes", () => {
    const cases = {
      "checkout.session.completed": PAYMENT_OUTCOMES.paid,
      "checkout.session.expired": PAYMENT_OUTCOMES.failed,
      "checkout.session.async_payment_failed": PAYMENT_OUTCOMES.failed,
      "payment_intent.created": PAYMENT_OUTCOMES.ignored,
    };
    for (const [type, outcome] of Object.entries(cases)) {
      const parsed = gateway.parseWebhookEvent(...signed({ type, data: { object: { metadata: { orderId: "o1" } } } }));
      assert.deepEqual(parsed, { outcome, orderId: "o1" }, type);
    }
  });

  test("rejects a bad signature with a 400 error", () => {
    assert.throws(() => gateway.parseWebhookEvent("{}", "t=1,v1=bad"), { status: 400 });
  });

  test("reports 503 when the webhook secret is not configured", () => {
    const unconfigured = new StripePaymentGateway({ secretKey: "sk_test_unit" });
    assert.throws(() => unconfigured.parseWebhookEvent("{}", "sig"), { status: 503 });
  });
});
