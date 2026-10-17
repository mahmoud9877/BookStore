import { BadRequestError } from "../../core/http-errors.js";
import { asyncHandler } from "../../middleware/error-handler.js";

export class OrderController {
  #orderService;

  constructor(orderService) {
    this.#orderService = orderService;
  }

  createOrder = asyncHandler(async (req, res) => {
    const { order, session } = await this.#orderService.placeOrder(req.user, req.body);
    if (session) {
      return res.status(201).json({ message: "Order created", session, url: session.url });
    }
    return res.status(201).json({ message: "Order created successfully", order });
  });

  /** Stripe webhook. Mounted in app.js with a raw body parser (signature verification needs it). */
  stripeWebhook = asyncHandler(async (req, res) => {
    let event;
    try {
      event = this.#orderService.verifyWebhookEvent(req.body, req.headers["stripe-signature"]);
    } catch (error) {
      if (!(error instanceof BadRequestError)) throw error;
      return res.status(400).send(error.message);
    }
    return res.json({ message: await this.#orderService.handleCheckoutEvent(event) });
  });

  cancelOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await this.#orderService.cancelOrder(orderId, req.user._id, req.body.reason);
    return res.status(200).json({ message: "Done", order });
  });

  deliverOrder = asyncHandler(async (req, res) => {
    const order = await this.#orderService.deliverOrder(req.params.orderId, req.user._id);
    return res.status(200).json({ message: "Order delivered successfully", order });
  });
}
