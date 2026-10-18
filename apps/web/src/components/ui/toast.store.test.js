import { toast, useToastStore } from "./toast.store.js";
import { resetStores } from "../../test-utils/reset-stores.js";

beforeEach(() => {
  resetStores();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const messages = () => useToastStore.getState().toasts.map((item) => item.message);

test("toasts are dismissed automatically", () => {
  toast.success("Saved.");
  expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ type: "success", message: "Saved." })]);
  jest.advanceTimersByTime(4000);
  expect(messages()).toEqual([]);
});

test("at most three toasts are visible; the oldest goes first", () => {
  ["one", "two", "three", "four"].forEach((message) => toast.info(message));
  expect(messages()).toEqual(["two", "three", "four"]);
});

test("a toast can be dismissed early", () => {
  const id = toast.error("Failed.");
  useToastStore.getState().dismiss(id);
  expect(messages()).toEqual([]);
});
