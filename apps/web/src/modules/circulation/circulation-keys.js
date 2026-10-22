/** Query key prefixes touched by circulation writes (a return changes loans, holds, members and fines). */
export const CIRCULATION_KEYS = [["loans"], ["reservations"], ["members"], ["fines"], ["payments"], ["reports"]];

/** "M-0000002" or a 24-hex id. */
export const looksLikeId = (value) => /^[a-f0-9]{24}$/i.test(String(value).trim());
