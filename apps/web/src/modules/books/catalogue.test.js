import { filterBooks } from "./catalogue.js";

const books = [
  { bookTitle: "dune", author: "frank herbert", price: 320, category: { _id: "c1", name: "fantasy" } },
  { bookTitle: "sapiens", author: "yuval noah harari", price: 410, category: { _id: "c2", name: "non-fiction" } },
  { bookTitle: "the hobbit", author: "j. r. r. tolkien", price: 250, category: { _id: "c1", name: "fantasy" } },
];
const titles = (list) => list.map((book) => book.bookTitle);

test("matches title or author, case-insensitively", () => {
  expect(titles(filterBooks(books, { query: "HARARI" }))).toEqual(["sapiens"]);
  expect(titles(filterBooks(books, { query: " hob " }))).toEqual(["the hobbit"]);
});

test("filters by category and sorts by price or title", () => {
  expect(titles(filterBooks(books, { category: "fantasy", sort: "price-asc" }))).toEqual(["the hobbit", "dune"]);
  expect(titles(filterBooks(books, { sort: "price-desc" }))).toEqual(["sapiens", "dune", "the hobbit"]);
  expect(titles(filterBooks(books, { sort: "title" }))).toEqual(["dune", "sapiens", "the hobbit"]);
});

test("never mutates the input list", () => {
  const copy = [...books];
  filterBooks(books, { sort: "price-asc" });
  expect(books).toEqual(copy);
});
