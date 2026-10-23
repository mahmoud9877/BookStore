import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrder } from "../services/order.service.js";
import { cartKeys } from "../../cart/queries/cart.queries.js";
import { bookKeys } from "../../books/queries/book.queries.js";
import { useAuthStore } from "../../auth/stores/auth.store.js";

/**
 * Places an order for the current cart. The server empties the cart and
 * reduces stock, so the cached cart is cleared and books are refetched.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  return useMutation({
    mutationFn: (details) => createOrder(details),
    onSuccess: () => {
      queryClient.setQueryData(cartKeys.mine(userId), []);
      return queryClient.invalidateQueries({ queryKey: bookKeys.all });
    },
  });
}
