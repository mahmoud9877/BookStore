import { Router } from "express";
import { CancelOrderDto, CreateOrderDto, OrderIdDto } from "./order.dto.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";

// POST /order/webhook is registered in app.js because it needs the raw request body.
export function createOrderRouter({ orderController, authGuard }) {
  const router = Router();

  router.post(
    "/",
    authGuard.authenticate(),
    validate(CreateOrderDto),
    orderController.createOrder
  );
  router.patch(
    "/:orderId/cancel",
    authGuard.authenticate(),
    validate(CancelOrderDto),
    orderController.cancelOrder
  );
  router.patch(
    "/:orderId/delivered",
    authGuard.authenticate([USER_ROLES.Admin]),
    validate(OrderIdDto),
    orderController.deliverOrder
  );

  return router;
}
