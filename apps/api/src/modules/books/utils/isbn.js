/** ISBN helpers. Stored ISBNs are normalized: digits only (plus a final "X" for ISBN-10). */

export const normalizeIsbn = (value) => String(value).replace(/[\s-]/g, "").toUpperCase();

function isValidIsbn10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, char, index) => total + (char === "X" ? 10 : Number(char)) * (10 - index), 0);
  return sum % 11 === 0;
}

function isValidIsbn13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, char, index) => total + Number(char) * (index % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

/** True for a well-formed ISBN-10 or ISBN-13 with a correct check digit. */
export const isValidIsbn = (value) => {
  const isbn = normalizeIsbn(value);
  return isValidIsbn10(isbn) || isValidIsbn13(isbn);
};
