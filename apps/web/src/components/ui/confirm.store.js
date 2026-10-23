import { create } from "zustand";
import { t } from "../../i18n/index.js";

/** The pending confirmation request rendered by <ConfirmDialog />, if any. */
export const useConfirmStore = create((set, get) => ({
  request: null,

  open(options) {
    get().request?.resolve(false); // a newer question supersedes an unanswered one
    return new Promise((resolve) => set({ request: { confirmLabel: t("Confirm"), tone: "danger", ...options, resolve } }));
  },

  settle(answer) {
    get().request?.resolve(answer);
    set({ request: null });
  },
}));

/**
 * Asks the user to confirm an action; resolves true or false.
 * `if (await confirm({ title, message, confirmLabel })) ...` — pass the texts already
 * translated with t(); the dialog shows them as given.
 */
export const confirm = (options) => useConfirmStore.getState().open(options);
