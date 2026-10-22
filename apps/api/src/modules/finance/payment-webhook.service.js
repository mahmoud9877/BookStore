/**
 * The single entry point for payment provider webhooks: verifies the event
 * once, then routes it by its metadata to library fines or shop orders.
 */
export class PaymentWebhookService {
  #gateway;
  #paymentService;
  #orderService;

  constructor({ paymentGateway, paymentService, orderService }) {
    this.#gateway = paymentGateway;
    this.#paymentService = paymentService;
    this.#orderService = orderService;
  }

  /** Throws BadRequestError for an invalid signature. Resolves a short outcome message. */
  async handle(rawBody, signature) {
    const event = this.#gateway.parseWebhookEvent(rawBody, signature);
    if (event.metadata?.kind === "fine_payment") {
      return this.#paymentService.applyProviderOutcome({
        outcome: event.outcome,
        paymentId: event.metadata.paymentId,
        paymentRef: event.paymentRef,
      });
    }
    return this.#orderService.applyPaymentEvent(event);
  }
}
