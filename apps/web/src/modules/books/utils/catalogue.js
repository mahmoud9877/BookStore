/** Pure catalogue filtering/sorting, kept separate from rendering so it is easy to test. */
import { msg, t, tp } from "../../../i18n/index.js";

export const SORT_OPTIONS = [
  { value: "newest", label: msg("Newest") },
  { value: "price-asc", label: msg("Price: low to high") },
  { value: "price-desc", label: msg("Price: high to low") },
  { value: "title", label: msg("Title A–Z") },
];

// What the shopper pays: the sale price while a discount is active.
const priceOf = (book) => book.salePrice ?? book.price;

const COMPARATORS = {
  newest: () => 0, // the API already returns newest first
  "price-asc": (a, b) => priceOf(a) - priceOf(b),
  "price-desc": (a, b) => priceOf(b) - priceOf(a),
  title: (a, b) => a.bookTitle.localeCompare(b.bookTitle),
};

export function filterBooks(books, { query = "", category = "", sort = "newest" }) {
  const needle = query.trim().toLowerCase();
  const isbnNeedle = needle.replace(/[\s-]/g, "");
  return books
    .filter((book) => !category || book.category?.name === category)
    .filter(
      (book) =>
        !needle ||
        book.bookTitle.toLowerCase().includes(needle) ||
        book.author.toLowerCase().includes(needle) ||
        (isbnNeedle.length >= 4 && Boolean(book.isbn?.toLowerCase().includes(isbnNeedle)))
    )
    .sort(COMPARATORS[sort] ?? COMPARATORS.newest);
}

/** Sort orders of the server-side catalogue search (GET /catalog/search). */
export const CATALOG_SORT_OPTIONS = [
  { value: "relevance", label: msg("Best match") },
  { value: "title", label: msg("Title A–Z") },
  { value: "newest", label: msg("Recently added") },
  { value: "year", label: msg("Publication year") },
  { value: "available", label: msg("Most available") },
];

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Category filter from the URL: an id, or (older links) a category name,
 * resolved against the category list. Returns the id or "".
 */
export function resolveCategory(value, categories) {
  if (!value) return "";
  if (OBJECT_ID.test(value)) return value;
  return categories.find((category) => category.name.toLowerCase() === value.toLowerCase())?._id ?? "";
}

/** "3 of 5 available", "All 2 copies on loan", or null when the library holds no copy. */
export function availabilityLabel(availability) {
  if (!availability?.total) return null;
  if (availability.available > 0) return t("{available} of {total} available to borrow", { available: availability.available, total: availability.total });
  return tp("copies.allOut", availability.total);
}
