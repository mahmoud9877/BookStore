import { useAuthStore } from "../modules/auth/auth.store.js";
import { useToastStore } from "../components/ui/toast.store.js";
import { useConfirmStore } from "../components/ui/confirm.store.js";

const STORES = [useAuthStore, useToastStore, useConfirmStore];

/** Zustand stores are module singletons; restore their initial state between tests. */
export function resetStores() {
  STORES.forEach((store) => store.setState(store.getInitialState(), true));
}
