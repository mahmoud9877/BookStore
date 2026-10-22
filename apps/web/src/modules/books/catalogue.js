/** Pure catalogue filtering/sorting, kept separate from rendering so it is easy to test. */

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "title", label: "Title A–Z" },
];

const COMPARATORS = {
  newest: () => 0, // the API already returns newest first
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
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
  { value: "relevance", label: "Best match" },
  { value: "title", label: "Title A–Z" },
  { value: "newest", label: "Recently added" },
  { value: "year", label: "Publication year" },
  { value: "available", label: "Most available" },
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
  if (availability.available > 0) return `${availability.available} of ${availability.total} available to borrow`;
  return `All ${availability.total} ${availability.total === 1 ? "copy is" : "copies are"} out`;
}
