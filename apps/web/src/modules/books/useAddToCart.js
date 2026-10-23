import { useLocation, useNavigate } from "react-router-dom";
import { formatTitle } from "../../lib/format.js";
import { useAddCartItem } from "../cart/cart.queries.js";
import { selectIsSignedIn, useAuthStore } from "../auth/auth.store.js";
import { getErrorMessage } from "../../lib/api-client.js";
import { toast } from "../../components/ui/toast.store.js";
import { msg, t } from "../../i18n/index.js";

/**
 * Adds a book to the cart with feedback. Anonymous visitors are sent to sign in
 * and brought back afterwards. `pendingId` is the book currently being added.
 */
export default function useAddToCart() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const addCartItem = useAddCartItem();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleAddToCart(book, quantity = 1) {
    if (!isSignedIn) {
      navigate("/login", {
        state: { from: location.pathname, notice: msg("Sign in to add books to your cart.") },
      });
      return;
    }
    try {
      await addCartItem.mutateAsync({ bookId: book._id, quantity });
      toast.success(t("Added “{title}” to your cart.", { title: formatTitle(book.bookTitle) }));
    } catch (err) {
      toast.error(getErrorMessage(err, t("Couldn't add this book to your cart.")));
    }
  }

  const pendingId = addCartItem.isPending ? addCartItem.variables?.bookId : null;
  return { addToCart: handleAddToCart, pendingId };
}
