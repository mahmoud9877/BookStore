import { confirm, useConfirmStore } from "./confirm.store.js";
import { resetStores } from "../../test-utils/reset-stores.js";

beforeEach(() => resetStores());
const settle = (answer) => useConfirmStore.getState().settle(answer);

test("resolves with the user's answer and closes", async () => {
  const answer = confirm({ title: "Delete?", message: "Sure?" });
  expect(useConfirmStore.getState().request).toMatchObject({ title: "Delete?", confirmLabel: "Confirm", tone: "danger" });
  settle(true);
  await expect(answer).resolves.toBe(true);
  expect(useConfirmStore.getState().request).toBeNull();
});

test("a newer question cancels an unanswered one", async () => {
  const first = confirm({ title: "First" });
  const second = confirm({ title: "Second", confirmLabel: "Yes" });
  await expect(first).resolves.toBe(false);
  settle(false);
  await expect(second).resolves.toBe(false);
});
