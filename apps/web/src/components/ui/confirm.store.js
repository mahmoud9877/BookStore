import { create } from "zustand";
import { msg } from "../../i18n/index.js";

const DEFAULTS = { confirmLabel: msg("Confirm"), tone: "danger" };

/** The pending confirmation request rendered by <ConfirmDialog />, if any. */
export const useConfirmStore = create((set, get) => ({
  request: null,

  open(options) {
    get().request?.resolve(false); // a newer question supersedes an unanswered one
    return new Promise((resolve) => set({ request: { ...DEFAULTS, ...options, resolve } }));
  },

  settle(answer) {
    get().request?.resolve(answer);
    set({ request: null });
  },
}));

/**
 * Asks the user to confirm an action; resolves true or false.
 * `if (await confirm({ title, message, confirmLabel })) ...`
 */
export const confirm = (options) => useConfirmStore.getState().open(options);
