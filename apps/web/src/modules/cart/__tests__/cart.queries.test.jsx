import { act, renderHook, waitFor } from "@testing-library/react";
import * as cartApi from "../services/cart.service.js";
import { useAuthStore } from "../../auth/stores/auth.store.js";
import { makeToken } from "../../../test-utils/make-token.js";
import { resetStores } from "../../../test-utils/reset-stores.js";
import { createQueryWrapper } from "../../../test-utils/query-wrapper.jsx";
import { cartKeys, useCartCount, useCartQuery, useForgetCartOnSignOut, useRemoveCartItem } from "../queries/cart.queries.js";

jest.mock("../services/cart.service.js");

const ITEMS = [
  { bookId: "b1", price: 320, quantity: 2 },
  { bookId: "b2", price: 410, quantity: 1 },
];

beforeEach(() => {
  localStorage.clear();
  resetStores();
  useAuthStore.getState().signIn(makeToken({ id: "u1" }));
  cartApi.getCartItems.mockResolvedValue(ITEMS);
});

test("loads the signed-in user's cart under a per-user key and derives the count", async () => {
  const { queryClient, wrapper } = createQueryWrapper();
  const { result } = renderHook(() => useCartCount(), { wrapper });
  await waitFor(() => expect(result.current).toBe(3));
  expect(queryClient.getQueryData(cartKeys.mine("u1"))).toEqual(ITEMS);
});

test("does not fetch when signed out", () => {
  useAuthStore.getState().signOut();
  const { wrapper } = createQueryWrapper();
  const { result } = renderHook(() => useCartQuery(), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
  expect(cartApi.getCartItems).not.toHaveBeenCalled();
});

test("removing an item is optimistic and rolls back if the request fails", async () => {
  const { queryClient, wrapper } = createQueryWrapper();
  queryClient.setQueryData(cartKeys.mine("u1"), ITEMS);
  let rejectRemove;
  cartApi.removeFromCart.mockReturnValue(new Promise((_, reject) => (rejectRemove = reject)));
  const { result } = renderHook(() => useRemoveCartItem(), { wrapper });

  act(() => {
    result.current.mutate("b1");
  });
  await waitFor(() => expect(queryClient.getQueryData(cartKeys.mine("u1"))).toEqual([ITEMS[1]]));
  expect(cartApi.removeFromCart).toHaveBeenCalledWith("b1"); // no React Query context leaks in

  await act(async () => rejectRemove(new Error("offline")));
  await waitFor(() => expect(queryClient.getQueryData(cartKeys.mine("u1"))).toEqual(ITEMS));
});

test("signing out drops the previous user's cached cart", async () => {
  const { queryClient, wrapper } = createQueryWrapper();
  queryClient.setQueryData(cartKeys.mine("u1"), ITEMS);
  renderHook(() => useForgetCartOnSignOut(queryClient), { wrapper });

  act(() => useAuthStore.getState().signOut());

  await waitFor(() => expect(queryClient.getQueryData(cartKeys.mine("u1"))).toBeUndefined());
});
