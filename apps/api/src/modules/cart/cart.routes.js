import { Router } from "express";
import * as cartController from "./cart.controller.js";
import * as validators from "./cart.validation.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

// Every cart route acts on the signed-in user's own cart.
router.use(authenticate());

router.get("/", cartController.getCart);
router.post("/add", validate(validators.addToCart), cartController.addToCart);
// Must be registered before "/:bookId".
router.delete("/clear", cartController.clearCart);
router.delete("/:bookId", validate(validators.removeCartItem), cartController.removeCartItem);

export default router;
