import { auth } from "../../middleware/authenticate.js";
import express, { Router } from "express";
import { endpoint } from "./order.endpoint.js";
import { validation } from "../../middleware/validate.js";
import * as validators from "./order.validation.js";
import * as orderController from "./order.controller.js";
const router = Router();

router.post(
  "/",
  auth(endpoint.create),
  // validation(validators.createOrder),
  orderController.createOrder
);
//
router.patch(
  "/:orderId/cancel",
  auth(endpoint.cancel),
  validation(validators.cancelOrder),
  orderController.cancelOrder
);
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  orderController.webhook
);
router.patch(
  "/:orderId/delivered",
  auth(endpoint.delivered),
  validation(validators.deliveredOrder),
  orderController.deliveredOrder
);
export default router;
