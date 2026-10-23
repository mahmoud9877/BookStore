import { asyncHandler } from "../../../middleware/error-handler.js";

export class OrderController {
  #orderService;

  constructor(orderService) {
    this.#orderService = orderService;
  }

  createOrder = asyncHandler(async (req, res) => {
    const { order, session } = await this.#orderService.placeOrder(req.user, req.dto);
    if (session) {
      return res.status(201).json({ message: "Order created", session, url: session.url });
    }
    return res.status(201).json({ message: "Order created successfully", order });
  });

  cancelOrder = asyncHandler(async (req, res) => {
    const order = await this.#orderService.cancelOrder(req.dto, req.user._id);
    return res.status(200).json({ message: "Done", order });
  });

  deliverOrder = asyncHandler(async (req, res) => {
    const order = await this.#orderService.deliverOrder(req.dto.orderId, req.user._id);
    return res.status(200).json({ message: "Order delivered successfully", order });
  });
}
