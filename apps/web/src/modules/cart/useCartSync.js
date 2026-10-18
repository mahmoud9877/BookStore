import { useEffect } from "react";
import { useCartStore } from "./cart.store.js";
import { selectIsSignedIn, useAuthStore } from "../auth/auth.store.js";

/** Loads the cart when someone signs in and clears it when they sign out. */
export default function useCartSync() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  useEffect(() => {
    const { load, reset } = useCartStore.getState();
    if (isSignedIn) load();
    else reset();
  }, [isSignedIn]);
}
