import { Router } from "express";
import { CancelOrderDto, CreateOrderDto, OrderIdDto } from "./order.dto.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../roles/permissions.js";

// POST /order/webhook is registered in app.js because it needs the raw request body.
export function createOrderRouter({ orderController, authGuard }) {
  const router = Router();

  router.post(
    "/",
    authGuard.signedIn(),
    validate(CreateOrderDto),
    orderController.createOrder
  );
  router.patch(
    "/:orderId/cancel",
    authGuard.signedIn(),
    validate(CancelOrderDto),
    orderController.cancelOrder
  );
  router.patch(
    "/:orderId/delivered",
    authGuard.requirePermission(PERMISSIONS.OrdersManage),
    validate(OrderIdDto),
    orderController.deliverOrder
  );

  return router;
}
