import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Carries the active database session through async calls, so repositories join
 * the surrounding transaction without every method taking a `session` argument.
 */
const storage = new AsyncLocalStorage();

export const currentSession = () => storage.getStore()?.session ?? null;

export const runWithSession = (session, fn) => storage.run({ session }, fn);
