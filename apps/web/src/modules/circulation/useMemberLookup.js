import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../lib/resource.js";
import { looksLikeId } from "./circulation-keys.js";

/** Looks a member up by number (as on the card) or id; idle while `ref` is empty. */
export function useMemberLookup(ref) {
  const value = String(ref ?? "").trim();
  return useQuery({
    queryKey: ["members", "lookup", value],
    queryFn: async () => (await fetchJson(looksLikeId(value) ? `/members/${value}` : `/members/number/${encodeURIComponent(value.toUpperCase())}`)).data,
    enabled: value.length >= 3,
  });
}
