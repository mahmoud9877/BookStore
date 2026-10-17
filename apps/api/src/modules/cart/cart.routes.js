import { Router } from "express";
import { AddToCartDto, CartItemIdDto } from "./cart.dto.js";
import { validate } from "../../middleware/validate.js";

export function createCartRouter({ cartController, authGuard }) {
  const router = Router();

  // Every cart route acts on the signed-in user's own cart.
  router.use(authGuard.authenticate());

  router.get("/", cartController.getCart);
  router.post("/add", validate(AddToCartDto), cartController.addToCart);
  // Must be registered before "/:bookId".
  router.delete("/clear", cartController.clearCart);
  router.delete("/:bookId", validate(CartItemIdDto), cartController.removeCartItem);

  return router;
}
