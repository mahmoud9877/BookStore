import { CURRENCY } from "../config/api.js";

const priceFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: CURRENCY,
  currencyDisplay: "code",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "EGP 320", "EGP 12.5" */
export const formatPrice = (amount) => priceFormatter.format(Number(amount) || 0);

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

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** "Oct 22, 2026" (empty for missing dates). */
export const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : "");

/** "Oct 22, 2026, 4:30 PM" */
export const formatDateTime = (value) => (value ? dateTimeFormatter.format(new Date(value)) : "");

/**
 * Library amounts are integers in the currency's minor unit (piastres/cents):
 * 1250 -> "EGP 12.50".
 */
export const formatMoney = (minor, currency = CURRENCY) =>
  new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code" }).format((Number(minor) || 0) / 100);

/** Major units typed by staff ("12.50") -> minor units (1250). */
export const toMinorUnits = (major) => Math.round(Number(major) * 100);

/** "on_loan" -> "On loan" */
export const humanize = (value = "") => {
  const text = String(value).replace(/[_-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Whole days from now until `date` (negative when in the past). */
export const daysUntil = (date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
