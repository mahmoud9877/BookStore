import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../auth/stores/auth.store.js";
import { addToCart, clearCart, getCartItems, removeFromCart } from "../services/cart.service.js";

export const cartKeys = {
  all: ["cart"],
  /** The cart is per user, so switching accounts never shows someone else's items. */
  mine: (userId) => [...cartKeys.all, userId],
};

export const countItems = (items) => items.reduce((sum, item) => sum + item.quantity, 0);
export const subtotalOf = (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const selectUserId = (state) => state.user?.id;

/** Query key for the signed-in user's cart, or null when signed out. */
function useCartKey() {
  const userId = useAuthStore(selectUserId);
  return userId ? cartKeys.mine(userId) : null;
}

/** The signed-in user's cart items (`select` derives a value from them). Idle when signed out. */
export function useCartQuery(select) {
  const key = useCartKey();
  return useQuery({
    queryKey: key ?? cartKeys.all,
    queryFn: getCartItems,
    enabled: Boolean(key),
    select,
  });
}

/** Number of copies in the cart; re-renders only when the count changes. */
export const useCartCount = () => useCartQuery(countItems).data ?? 0;

export function useAddCartItem() {
  const queryClient = useQueryClient();
  const key = useCartKey();
  return useMutation({
    mutationFn: ({ bookId, quantity = 1 }) => addToCart(bookId, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/**
 * Optimistic cart change: apply `update` to the cached items immediately,
 * roll back if the request fails, then re-sync with the server.
 */
function useOptimisticCartMutation(mutationFn, update) {
  const queryClient = useQueryClient();
  const key = useCartKey();
  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (items = []) => update(items, variables));
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

// Wrapped so services never receive React Query's second (context) argument.
export const useRemoveCartItem = () =>
  useOptimisticCartMutation((bookId) => removeFromCart(bookId), (items, bookId) =>
    items.filter((item) => String(item.bookId) !== String(bookId))
  );

export const useClearCart = () => useOptimisticCartMutation(() => clearCart(), () => []);

/** Drops the previous user's cached cart when they sign out (in this or another tab). */
export function useForgetCartOnSignOut(queryClient) {
  const userId = useAuthStore(selectUserId);
  const previousUserId = useRef(userId);
  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) {
      queryClient.removeQueries({ queryKey: cartKeys.mine(previousUserId.current) });
    }
    previousUserId.current = userId;
  }, [queryClient, userId]);
}
