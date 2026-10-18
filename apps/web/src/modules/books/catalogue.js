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
  return books
    .filter((book) => !category || book.category === category)
    .filter(
      (book) =>
        !needle ||
        book.bookTitle.toLowerCase().includes(needle) ||
        book.author.toLowerCase().includes(needle)
    )
    .sort(COMPARATORS[sort] ?? COMPARATORS.newest);
}
