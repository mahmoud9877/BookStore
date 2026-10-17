import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import endpoint from "../cart/cart.endpoint.js";
import * as cartController from "../cart/cart.js";

const router = Router();

// Assuming auth middleware adds the authenticated user's info to req.user
router.get(
  "/",
  auth(),
  cartController.getCart // Controller to handle the cart retrieval
);

router.post(
  "/add",
  auth(endpoint.addToCart),
  // validation(validators.addToCart),
  cartController.addToCart
);

// Route to clear the cart
router.delete("/clear", auth(endpoint.addToCart));

router.delete(
  "/:bookId",
  auth(endpoint.deleteFromCart),
  cartController.deleteCartItem
);

export default router;
