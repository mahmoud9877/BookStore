import { useAuthStore } from "../modules/auth/stores/auth.store.js";
import { useToastStore } from "../components/ui/toast.store.js";
import { useConfirmStore } from "../components/ui/confirm.store.js";
import { clearAuthToken } from "../lib/auth-token.js";

const STORES = [useAuthStore, useToastStore, useConfirmStore];

/** Zustand stores are module singletons; restore their initial state between tests. */
export function resetStores() {
  clearAuthToken();
  STORES.forEach((store) => store.setState(store.getInitialState(), true));
}
