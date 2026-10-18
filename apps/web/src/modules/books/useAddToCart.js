import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatTitle } from "../../lib/format.js";
import { useUser } from "../auth/UserContext.jsx";
import { useCart } from "../cart/CartContext.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import { useToast } from "../../components/ui/ToastProvider.jsx";

/**
 * Adds a book to the cart with feedback. Anonymous visitors are sent to sign in
 * and brought back afterwards. `pendingId` is the book currently being added.
 */
export default function useAddToCart() {
  const { userData } = useUser();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingId, setPendingId] = useState(null);

  async function addToCart(book, quantity = 1) {
    if (!userData) {
      navigate("/login", {
        state: { from: location.pathname, notice: "Sign in to add books to your cart." },
      });
      return;
    }
    setPendingId(book._id);
    try {
      await cart.add(book._id, quantity);
      toast.success(`Added “${formatTitle(book.bookTitle)}” to your cart.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add this book to your cart."));
    } finally {
      setPendingId(null);
    }
  }

  return { addToCart, pendingId };
}
