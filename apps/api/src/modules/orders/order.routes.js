import { Router } from "express";
import * as orderController from "./order.controller.js";
import * as validators from "./order.validation.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";

// POST /order/webhook is registered in app.js because it needs the raw request body.
const router = Router();

router.post("/", authenticate(), validate(validators.createOrder), orderController.createOrder);
router.patch(
  "/:orderId/cancel",
  authenticate(),
  validate(validators.cancelOrder),
  orderController.cancelOrder
);
router.patch(
  "/:orderId/delivered",
  authenticate([USER_ROLES.Admin]),
  validate(validators.deliverOrder),
  orderController.deliverOrder
);

export default router;
