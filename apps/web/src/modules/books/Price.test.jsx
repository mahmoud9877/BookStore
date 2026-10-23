import React from "react";
import { render, screen } from "@testing-library/react";
import Price, { BookPrice } from "./Price.jsx";

const BOOK = { _id: "b1", price: 320, salePrice: 320, activeDiscountPercent: 0 };

test("a book without an active discount shows only its price", () => {
  render(<BookPrice book={BOOK} />);
  expect(screen.getByText(/EGP\s320/)).toBeInTheDocument();
  expect(screen.queryByText("Original price")).not.toBeInTheDocument();
  expect(screen.queryByText(/%/)).not.toBeInTheDocument();
});

test("a book on sale shows the sale price, the struck-through original and the saving", () => {
  render(<BookPrice book={{ ...BOOK, discountPercent: 20, salePrice: 256, activeDiscountPercent: 20 }} />);
  expect(screen.getByText(/EGP\s256/)).toBeInTheDocument();
  const original = screen.getByText(/EGP\s320/);
  expect(original.tagName).toBe("DEL");
  expect(original).toHaveTextContent(/Original price\s*EGP\s320/);
  expect(screen.getByText("−20%")).toBeInTheDocument();
});

test("an expired discount (stored but not active) is ignored", () => {
  render(<BookPrice book={{ ...BOOK, discountPercent: 20, activeDiscountPercent: 0 }} />);
  expect(screen.queryByText("Original price")).not.toBeInTheDocument();
  expect(screen.queryByText(/%/)).not.toBeInTheDocument();
});

test("a cart line derives the saving from its original price", () => {
  render(<Price amount={240} original={300} />);
  expect(screen.getByText("−20%")).toBeInTheDocument();
});
