import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatTitle } from "../../lib/format.js";
import { useCartStore } from "../cart/cart.store.js";
import { selectIsSignedIn, useAuthStore } from "../auth/auth.store.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { toast } from "../../components/ui/toast.store.js";

/**
 * Adds a book to the cart with feedback. Anonymous visitors are sent to sign in
 * and brought back afterwards. `pendingId` is the book currently being added.
 */
export default function useAddToCart() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const addToCart = useCartStore((state) => state.add);
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingId, setPendingId] = useState(null);

  async function handleAddToCart(book, quantity = 1) {
    if (!isSignedIn) {
      navigate("/login", {
        state: { from: location.pathname, notice: "Sign in to add books to your cart." },
      });
      return;
    }
    setPendingId(book._id);
    try {
      await addToCart(book._id, quantity);
      toast.success(`Added “${formatTitle(book.bookTitle)}” to your cart.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add this book to your cart."));
    } finally {
      setPendingId(null);
    }
  }

  return { addToCart: handleAddToCart, pendingId };
}
