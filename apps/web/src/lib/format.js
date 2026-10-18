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
