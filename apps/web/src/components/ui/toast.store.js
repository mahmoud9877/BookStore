import { create } from "zustand";

const DISMISS_AFTER_MS = 4000;
const MAX_VISIBLE = 3;
let nextId = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],

  show(type, message) {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts.slice(-(MAX_VISIBLE - 1)), { id, type, message }] }));
    setTimeout(() => get().dismiss(id), DISMISS_AFTER_MS);
    return id;
  },

  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

/** Non-blocking notifications, callable from anywhere: `toast.success("Saved.")`. */
export const toast = {
  success: (message) => useToastStore.getState().show("success", message),
  error: (message) => useToastStore.getState().show("error", message),
  info: (message) => useToastStore.getState().show("info", message),
};
