import { formatName, formatPrice, formatTitle, initials, pluralize } from "./format.js";

test("prices use the checkout currency", () => {
  expect(formatPrice(320)).toMatch(/^EGP\s320$/);
  expect(formatPrice(12.5)).toMatch(/^EGP\s12\.5$/);
  expect(formatPrice("1050")).toMatch(/^EGP\s1,050$/);
});

test("titles keep minor words lowercase except at the start", () => {
  expect(formatTitle("to kill a mockingbird")).toBe("To Kill a Mockingbird");
  expect(formatTitle("the lord of the rings")).toBe("The Lord of the Rings");
  expect(formatTitle("1984")).toBe("1984");
});

test("names capitalise every part, including initials", () => {
  expect(formatName("j. r. r. tolkien")).toBe("J. R. R. Tolkien");
  expect(formatName("yuval noah harari")).toBe("Yuval Noah Harari");
});

test("initials and plurals", () => {
  expect(initials("Store Admin")).toBe("SA");
  expect(initials("")).toBe("?");
  expect(pluralize(1, "book")).toBe("1 book");
  expect(pluralize(3, "book")).toBe("3 books");
});
