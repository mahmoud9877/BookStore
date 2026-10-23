import React from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import CopiesPage from "./CopiesPage.jsx";
import TransfersPage from "../transfers/TransfersPage.jsx";
import StocktakesPage from "../inventory/StocktakesPage.jsx";
import AcquisitionsPage from "../acquisitions/AcquisitionsPage.jsx";
import BookForm from "../books/BookForm.jsx";
import { apiClient } from "../../lib/api-client.js";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const ME = { user: { role: "Admin", permissions: ["copies:manage", "inventory:manage", "acquisitions:manage", "books:manage"] } };
const MAIN = { _id: "br1", code: "MAIN", name: "Main Library", isActive: true };
const EAST = { _id: "br2", code: "EAST", name: "East Branch", isActive: true };
const DUNE = { _id: "b1", bookTitle: "dune", author: "frank herbert" };
const page = (data) => ({ data, meta: { page: 1, limit: 20, total: data.length, pages: 1 } });
const copy = (overrides) => ({ _id: "c1", barcode: "MAIN-0000001", book: DUNE, branch: MAIN, location: null, status: "available", condition: "good", cost: 15000, ...overrides });

const use = (routes) => Object.assign(apiClient, fakeApi({ "GET /auth/me": ME, "GET /branches/active": { data: [MAIN, EAST] }, ...routes }));

describe("copies", () => {
  test("adding copies sends the cost in minor units", async () => {
    use({
      "GET /copies": page([]),
      "GET /catalog/search": page([DUNE]),
      "GET /locations": page([{ _id: "l1", type: "shelf", code: "A-01", name: "Fiction" }]),
      "POST /copies": ({ body }) => ({ data: [copy({ cost: body.cost })] }),
    });
    renderPage(<CopiesPage />, { path: "/dashboard/copies" });
    userEvent.click(await screen.findByRole("button", { name: /Add copies/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add copies" });
    userEvent.type(within(dialog).getByLabelText("Book"), "dune");
    userEvent.click(await within(dialog).findByRole("button", { name: /Dune/ }));
    userEvent.selectOptions(within(dialog).getByLabelText("Branch"), "br1");
    userEvent.selectOptions(await within(dialog).findByLabelText("Shelf"), await within(dialog).findByRole("option", { name: /A-01/ }));
    userEvent.clear(within(dialog).getByLabelText("Copies"));
    userEvent.type(within(dialog).getByLabelText("Copies"), "3");
    userEvent.type(within(dialog).getByLabelText(/Cost per copy/), "12.50");
    userEvent.click(within(dialog).getByRole("button", { name: "Add copies" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const [url, body] = apiClient.post.mock.calls[0];
    expect(url).toBe("/copies");
    expect(body).toMatchObject({ book: "b1", branch: "br1", location: "l1", count: 3, cost: 1250, condition: "new" });
  });

  test("a status change needs a reason and only offers the allowed transitions", async () => {
    use({
      "GET /copies": page([copy({ status: "damaged" })]),
      "POST /copies/c1/status": ({ body }) => ({ data: copy({ status: body.status }) }),
    });
    renderPage(<CopiesPage />, { path: "/dashboard/copies" });
    userEvent.click(await screen.findByRole("button", { name: "Change status of MAIN-0000001" }));
    const dialog = await screen.findByRole("dialog");
    const options = within(within(dialog).getByLabelText("New status")).getAllByRole("option").map((option) => option.value);
    expect(options).toEqual(["available", "withdrawn", "lost"]);

    userEvent.click(within(dialog).getByRole("button", { name: "Change status" }));
    expect(await within(dialog).findByText(/Give a reason/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();

    userEvent.selectOptions(within(dialog).getByLabelText("New status"), "withdrawn");
    userEvent.type(within(dialog).getByLabelText("Reason"), "Beyond repair");
    userEvent.click(within(dialog).getByRole("button", { name: "Change status" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/copies/c1/status", { status: "withdrawn", reason: "Beyond repair" }));
  });

  test("copies on loan cannot be adjusted by hand", async () => {
    use({ "GET /copies": page([copy({ status: "on_loan" })]) });
    renderPage(<CopiesPage />, { path: "/dashboard/copies" });
    userEvent.click(await screen.findByRole("button", { name: "Change status of MAIN-0000001" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/changes only through its loan/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Change status" })).not.toBeInTheDocument();
  });
});

test("receiving a transfer in transit", async () => {
  const transfer = {
    _id: "t1", copy: { barcode: "EAST-0000003" }, book: DUNE, fromBranch: EAST, toBranch: MAIN, status: "in_transit", reason: "reservation",
    history: [{ status: "in_transit", at: "2026-10-22T10:00:00Z", note: "Sent automatically" }], updatedAt: "2026-10-22T10:00:00Z",
  };
  use({ "GET /transfers": page([transfer]), "POST /transfers/t1/receive": { data: { ...transfer, status: "received" } } });
  renderPage(<TransfersPage />, { path: "/dashboard/transfers" });
  userEvent.click(await screen.findByRole("button", { name: "Receive EAST-0000003" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/transfers/t1/receive", { note: undefined }));
  expect(await screen.findByText("Transfer received.")).toBeInTheDocument();
});

test("a stocktake records scans and closes, applying the results", async () => {
  const stocktake = {
    _id: "s1", branch: MAIN, status: "open", createdAt: "2026-10-22T10:00:00Z",
    progress: { expected: 3, scanned: 0, missing: ["MAIN-1", "MAIN-2", "MAIN-3"], foundAgain: [], unexpected: [] },
  };
  use({
    "GET /stocktakes": page([stocktake]),
    "GET /stocktakes/s1": { data: stocktake },
    "POST /stocktakes/s1/scans": { data: stocktake },
    "POST /stocktakes/s1/close": { data: { ...stocktake, status: "closed" } },
  });
  renderPage(<StocktakesPage />, { path: "/dashboard/stocktakes" });
  userEvent.click(await screen.findByRole("button", { name: "Continue" }));
  userEvent.type(await screen.findByLabelText(/Scan barcodes/), "main-1{enter}MAIN-2{enter}main-1");
  userEvent.click(screen.getByRole("button", { name: "Record scans" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/stocktakes/s1/scans", { barcodes: ["MAIN-1", "MAIN-2"] }));

  userEvent.click(screen.getByRole("button", { name: "Close stocktake" }));
  const dialog = await screen.findByRole("dialog", { name: "Close this stocktake?" });
  userEvent.click(within(dialog).getByRole("button", { name: "Close stocktake" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/stocktakes/s1/close", { apply: true }));
});

test("receiving a purchase-order delivery, line by line", async () => {
  const order = {
    _id: "po1", number: "PO-000001", status: "ordered", branch: MAIN, supplier: { _id: "s1", name: "Nile Books" }, currency: "EGP",
    lines: [{ _id: "line1", book: DUNE, quantity: 3, unitCost: 14000, received: 1 }],
    deliveries: [], documents: [], totalCost: 42000, receivedCost: 14000, createdAt: "2026-10-22T10:00:00Z",
  };
  use({
    "GET /purchase-orders": page([order]),
    "GET /purchase-orders/po1": { data: order },
    "POST /purchase-orders/po1/deliveries": { data: { ...order, status: "received" } },
  });
  renderPage(<AcquisitionsPage />, { path: "/dashboard/acquisitions" });
  userEvent.click(await screen.findByRole("button", { name: /Open PO-000001/ }));
  userEvent.click(await screen.findByRole("button", { name: "Receive delivery" }));
  const quantity = await screen.findByLabelText(/Dune \(1 of 3 received\)/);
  expect(quantity).toHaveValue(2);
  userEvent.clear(quantity);
  userEvent.type(quantity, "3");
  userEvent.click(screen.getByRole("button", { name: "Record delivery" }));
  expect(await screen.findByText(/more than was ordered/)).toBeInTheDocument();

  userEvent.clear(quantity);
  userEvent.type(quantity, "2");
  userEvent.type(screen.getByLabelText(/Delivery note/), "DN-7");
  userEvent.click(screen.getByRole("button", { name: "Record delivery" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/purchase-orders/po1/deliveries", { reference: "DN-7", lines: [{ line: "line1", quantity: 2 }] }));
});

describe("book form", () => {
  const renderForm = (onSubmit, book) => {
    use({ "GET /publishers": page([{ _id: "p1", name: "Ace Books" }]) });
    renderPage(
      <>
        <BookForm book={book} categories={[{ _id: "c1", name: "fantasy" }]} onSubmit={onSubmit} />
        <button type="submit" form="book-form">
          Save
        </button>
      </>,
      { path: "/dashboard/books" }
    );
  };

  test("sends ISBN, publisher and edition details; the cover is optional", async () => {
    const onSubmit = jest.fn();
    renderForm(onSubmit);
    userEvent.type(screen.getByLabelText("Title"), "Dune");
    userEvent.type(screen.getByLabelText("Author"), "Frank Herbert");
    userEvent.selectOptions(screen.getByLabelText("Category"), "c1");
    userEvent.type(screen.getByLabelText("Description"), "Desert planet.");
    userEvent.selectOptions(screen.getByLabelText("Publisher"), await screen.findByRole("option", { name: "Ace Books" }));
    userEvent.type(screen.getByLabelText(/ISBN/), "978-0-441-17271-9");
    userEvent.type(screen.getByLabelText("Year"), "1965");
    userEvent.type(screen.getByLabelText("Subjects"), "science fiction, ecology");
    userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const formData = onSubmit.mock.calls[0][0];
    expect(formData.get("isbn")).toBe("978-0-441-17271-9");
    expect(formData.get("publisher")).toBe("p1");
    expect(formData.get("publicationYear")).toBe("1965");
    expect(formData.get("subjects")).toBe("science fiction, ecology");
    expect(formData.get("isForSale")).toBe("false");
    expect(formData.get("price")).toBe("0");
    expect(formData.get("image")).toBeNull();
  });

  test("rejects an ISBN whose check digit is wrong", async () => {
    const onSubmit = jest.fn();
    renderForm(onSubmit);
    userEvent.type(screen.getByLabelText("Title"), "Dune");
    userEvent.type(screen.getByLabelText("Author"), "Frank Herbert");
    userEvent.selectOptions(screen.getByLabelText("Category"), "c1");
    userEvent.type(screen.getByLabelText("Description"), "Desert planet.");
    userEvent.type(screen.getByLabelText(/ISBN/), "9780441172710");
    userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This ISBN's check digit doesn't match.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("shop price and stock are only asked for titles sold in the shop", () => {
    renderForm(jest.fn());
    expect(screen.queryByLabelText(/Price/)).not.toBeInTheDocument();
    userEvent.click(screen.getByLabelText("For sale in the shop"));
    expect(screen.getByLabelText(/Price/)).toBeInTheDocument();
    expect(screen.getByLabelText("Shop stock")).toBeInTheDocument();
  });
});
