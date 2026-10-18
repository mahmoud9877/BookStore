import { act, renderHook } from "@testing-library/react";
import * as orderApi from "./order.service.js";
import { usePlaceOrder } from "./order.queries.js";
import { cartKeys } from "../cart/cart.queries.js";
import { bookKeys } from "../books/book.queries.js";
import { useAuthStore } from "../auth/auth.store.js";
import { makeToken } from "../../test-utils/make-token.js";
import { resetStores } from "../../test-utils/reset-stores.js";
import { createQueryWrapper } from "../../test-utils/query-wrapper.jsx";

jest.mock("./order.service.js");

test("placing an order empties the cached cart and refreshes stock", async () => {
  resetStores();
  useAuthStore.getState().signIn(makeToken({ id: "u1" }));
  const { queryClient, wrapper } = createQueryWrapper();
  queryClient.setQueryData(cartKeys.mine("u1"), [{ bookId: "b1", price: 10, quantity: 1 }]);
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  orderApi.createOrder.mockResolvedValue({ order: { _id: "o1" } });
  const details = { address: "1 Nile St", phone: "0100", note: "", paymentType: "cash" };

  const { result } = renderHook(() => usePlaceOrder(), { wrapper });
  await act(() => result.current.mutateAsync(details));

  expect(orderApi.createOrder).toHaveBeenCalledWith(details);
  expect(queryClient.getQueryData(cartKeys.mine("u1"))).toEqual([]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: bookKeys.all });
});
