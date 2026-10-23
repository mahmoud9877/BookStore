import React from "react";
import { Link } from "react-router-dom";
import { LOW_STOCK_THRESHOLD } from "./StockNote.jsx";
import BookCover from "../../../components/ui/BookCover.jsx";
import { BookPrice } from "./Price.jsx";
import { formatName, formatTitle } from "../../../lib/format.js";
import { t } from "../../../i18n/index.js";

function StockBadge({ quantity }) {
  if (quantity <= 0) return <span className="badge text-bg-danger">{t("Out of stock")}</span>;
  if (quantity <= LOW_STOCK_THRESHOLD) return <span className="badge text-bg-warning">{t("{quantity} · low", { quantity })}</span>;
  return <span className="badge text-bg-light border">{quantity}</span>;
}

/** Catalogue table for administrators. */
export default function BookList({ books, onEdit, onDelete }) {
  return (
    <div className="table-responsive">
      <table className="table data-table align-middle">
        <thead>
          <tr>
            <th scope="col">{t("Book")}</th>
            <th scope="col" className="d-none d-md-table-cell">
              {t("Category")}
            </th>
            <th scope="col" className="text-end d-none d-sm-table-cell">
              {t("Price")}
            </th>
            <th scope="col" className="text-center">
              {t("Shop stock")}
            </th>
            <th scope="col" className="text-end">
              <span className="visually-hidden">{t("Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => {
            const title = formatTitle(book.bookTitle);
            return (
              <tr key={book._id}>
                <td>
                  <div className="d-flex align-items-center gap-3">
                    <BookCover src={book.image} alt="" className="table-cover" />
                    <div className="min-w-0">
                      <div className="fw-semibold text-truncate">{title}</div>
                      <div className="small text-muted text-truncate">
                        {formatName(book.author)}
                        {book.isbn && ` · ISBN ${book.isbn}`}
                        {book.edition && ` · ${t("{edition} ed.", { edition: book.edition })}`}
                      </div>
                      {book.isForSale !== false && <div className="small fw-semibold d-sm-none"><BookPrice book={book} /></div>}
                    </div>
                  </div>
                </td>
                <td className="d-none d-md-table-cell text-capitalize">{book.category?.name}</td>
                <td className="text-end text-nowrap d-none d-sm-table-cell">{book.isForSale === false ? <span className="text-muted">—</span> : <BookPrice book={book} />}</td>
                <td className="text-center">
                  {book.isForSale === false ? <span className="small text-muted">{t("Library only")}</span> : <StockBadge quantity={book.quantity} />}
                </td>
                <td className="text-end text-nowrap">
                  <Link to={`/dashboard/copies?book=${book._id}`} className="btn btn-sm btn-ghost" aria-label={t("Copies of {title}", { title })}>
                    <i className="bi bi-upc" aria-hidden="true"></i>
                  </Link>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(book)} aria-label={t("Edit {name}", { name: title })}>
                    <i className="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-danger"
                    onClick={() => onDelete(book)}
                    aria-label={t("Delete {name}", { name: title })}
                  >
                    <i className="bi bi-trash3" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
