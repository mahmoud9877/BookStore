import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../lib/resource.js";
import { selectUser, useAuthStore } from "../auth/auth.store.js";

/** Query keys of the member's own account; mutations invalidate ["me", ...]. */
export const accountKeys = {
  all: ["me", "account"],
  membership: () => [...accountKeys.all, "membership"],
  loans: () => [...accountKeys.all, "loans"],
  reservations: () => [...accountKeys.all, "reservations"],
  fines: () => [...accountKeys.all, "fines"],
  payments: () => [...accountKeys.all, "payments"],
  notifications: () => [...accountKeys.all, "notifications"],
  /** The bell's unread count (a number); the notification stream writes it directly. */
  unreadNotifications: () => [...accountKeys.notifications(), "unread"],
  /** The newest few notifications shown in the bell's dropdown. */
  latestNotifications: () => [...accountKeys.notifications(), "latest"],
  bookings: () => [...accountKeys.all, "bookings"],
  events: () => [...accountKeys.all, "events"],
};

const selectUserId = (state) => selectUser(state)?.id;

/**
 * The signed-in user's library membership (GET /members/me). `data` is null when
 * no membership is linked to the account (the API answers 404); idle when signed out.
 */
export function useOwnMembership() {
  const userId = useAuthStore(selectUserId);
  return useQuery({
    queryKey: [...accountKeys.membership(), userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return (await fetchJson("/members/me")).data;
      } catch (error) {
        if (error?.response?.status === 404) return null;
        throw error;
      }
    },
  });
}
