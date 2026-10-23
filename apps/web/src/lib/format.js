import { CURRENCY } from "../config/api.js";
import { currentLocale, t, tp } from "../i18n/index.js";

// Formatters follow the interface language (cached per locale).
const cache = new Map();
const formatter = (kind, options) => {
  const key = `${currentLocale()}|${kind}|${JSON.stringify(options)}`;
  if (!cache.has(key)) cache.set(key, new (kind === "date" ? Intl.DateTimeFormat : Intl.NumberFormat)(currentLocale(), options));
  return cache.get(key);
};

/** "EGP 320", "EGP 12.5" (shop prices, in major units). */
export const formatPrice = (amount) =>
  formatter("number", { style: "currency", currency: CURRENCY, currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    Number(amount) || 0
  );

/** 1234 -> "1,234" (in the interface language). */
export const formatNumber = (value) => formatter("number", {}).format(Number(value) || 0);

const MINOR_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);

/** Book titles are stored lowercase by the API: "to kill a mockingbird" -> "To Kill a Mockingbird". */
export function formatTitle(text = "") {
  return text
    .split(" ")
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

/** "j. r. r. tolkien" -> "J. R. R. Tolkien" */
export const formatName = (text = "") => text.replace(/(^|[\s.-])(\p{L})/gu, (match) => match.toUpperCase());

/** Initials for an avatar: "Store Admin" -> "SA". */
export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

/**
 * A counted noun in the interface language: `pluralize(3, "book")` → "3 books" /
 * "3 كتب". The noun must have a plural table in i18n/ar/common.js (id = the
 * singular English noun); prefer tp() directly in new code.
 */
export const pluralize = (count, noun) => tp(noun, count);

/** "Oct 22, 2026" / "22 أكتوبر 2026" (empty for missing dates). */
export const formatDate = (value) => (value ? formatter("date", { dateStyle: "medium" }).format(new Date(value)) : "");

/** "Oct 22, 2026, 4:30 PM" */
export const formatDateTime = (value) => (value ? formatter("date", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "");

/**
 * An end date picked in a date input ("2026-10-31") as the last moment of that day
 * in the user's time zone, so a sale or coupon lasts through the day chosen.
 */
export const endOfDay = (day) => (day ? new Date(`${day}T23:59:59.999`).toISOString() : "");

/** A stored date as the local day for a date input: "2026-10-31T20:59:59.999Z" -> "2026-10-31" (in Cairo). */
export const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** "4:30 PM" */
export const formatTime = (value) => (value ? formatter("date", { timeStyle: "short" }).format(new Date(value)) : "");

/**
 * Library amounts are integers in the currency's minor unit (piastres/cents):
 * 1250 -> "EGP 12.50".
 */
export const formatMoney = (minor, currency = CURRENCY) =>
  formatter("number", { style: "currency", currency, currencyDisplay: "code" }).format((Number(minor) || 0) / 100);

/** Major units typed by staff ("12.50") -> minor units (1250). */
export const toMinorUnits = (major) => Math.round(Number(major) * 100);

/**
 * An API enum value as readable text in the interface language:
 * "on_loan" -> "On loan" / "معار". The English phrases are translated in
 * i18n/ar/common.js (statuses, types, kinds…).
 */
export const humanize = (value = "") => {
  const text = String(value).replace(/[_-]+/g, " ");
  return t(text.charAt(0).toUpperCase() + text.slice(1));
};

/** Whole days from now until `date` (negative when in the past). */
export const daysUntil = (date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
