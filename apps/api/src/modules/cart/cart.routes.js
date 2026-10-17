import { Router } from "express";
import * as validators from "./cart.validation.js";
import { validate } from "../../middleware/validate.js";

export function createCartRouter({ cartController, authGuard }) {
  const router = Router();

  // Every cart route acts on the signed-in user's own cart.
  router.use(authGuard.authenticate());

  router.get("/", cartController.getCart);
  router.post("/add", validate(validators.addToCart), cartController.addToCart);
  // Must be registered before "/:bookId".
  router.delete("/clear", cartController.clearCart);
  router.delete("/:bookId", validate(validators.removeCartItem), cartController.removeCartItem);

  return router;
}
