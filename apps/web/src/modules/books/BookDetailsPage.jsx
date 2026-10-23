import { Helmet } from "react-helmet";
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import StockNote, { LOW_STOCK_THRESHOLD } from "./StockNote.jsx";
import useAddToCart from "./useAddToCart.js";
import BookCard, { AvailabilityNote } from "./BookCard.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import { bookKeys, useBookQuery, useEditions, useRelatedBooks } from "./book.queries.js";
import { apiClient, getErrorMessage, responseData } from "../../lib/api-client.js";
import BookCover from "../../components/ui/BookCover.jsx";
import { ErrorState } from "../../components/ui/StatePanel.jsx";
import { toast } from "../../components/ui/toast.store.js";
import { BookPrice } from "./Price.jsx";
import { formatName, formatTitle } from "../../lib/format.js";
import { useActiveBranches } from "../branches/branch.queries.js";
import { accountKeys, useOwnMembership } from "../account/account.queries.js";
import { selectIsSignedIn, useAuthStore } from "../auth/auth.store.js";
import { msg, t } from "../../i18n/index.js";

function QuantityStepper({ value, max, onChange }) {
  return (
    <div className="quantity-stepper" role="group" aria-label={t("Quantity")}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={t("Decrease quantity")}>
        <i className="bi bi-dash" aria-hidden="true"></i>
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t("Increase quantity")}>
        <i className="bi bi-plus" aria-hidden="true"></i>
      </button>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="row g-4 g-lg-5" aria-busy="true" aria-label={t("Loading book")}>
      <div className="col-md-5 col-lg-4">
        <div className="skeleton" style={{ aspectRatio: "2 / 3", maxWidth: 360 }}></div>
      </div>
      <div className="col-md-7 col-lg-8">
        <div className="skeleton mb-3" style={{ height: 36, width: "70%" }}></div>
        <div className="skeleton mb-4" style={{ height: 18, width: "40%" }}></div>
        <div className="skeleton mb-2" style={{ height: 14 }}></div>
        <div className="skeleton" style={{ height: 14, width: "90%" }}></div>
      </div>
    </div>
  );
}

/** Copies per branch, with the branch names. */
function BranchAvailability({ availability, branches }) {
  const rows = Object.entries(availability?.byBranch ?? {});
  if (!rows.length) {
    return <p className="text-muted small">{t("The library has no copies of this edition to lend yet.")}</p>;
  }
  const nameOf = (id) => branches.find((branch) => branch._id === id)?.name ?? t("Another branch");
  return (
    <ul className="list-group mb-3">
      {rows.map(([branchId, counts]) => (
        <li key={branchId} className="list-group-item d-flex justify-content-between align-items-center">
          <span>{nameOf(branchId)}</span>
          <span className={counts.available ? "text-success small fw-semibold" : "text-muted small"}>
            {counts.available ? t("{available} of {total} on the shelf", { available: counts.available, total: counts.total }) : t("All {total} out", { total: counts.total })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Reserve for pickup at a branch (members). Anonymous visitors are asked to sign in. */
function ReservePanel({ book, branches }) {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const membership = useOwnMembership();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [pickupBranch, setPickupBranch] = useState("");

  useEffect(() => {
    if (!pickupBranch && membership.data?.homeBranch?._id) setPickupBranch(membership.data.homeBranch._id);
  }, [membership.data, pickupBranch]);

  const reserve = useMutation({
    mutationFn: async () => (await responseData(apiClient.post("/reservations/me", { book: book._id, pickupBranch }))).data,
    onSuccess: (reservation) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: bookKeys.detail(book._id) });
      const where = branches.find((branch) => branch._id === pickupBranch)?.name ?? t("your branch");
      toast.success(
        reservation?.status === "ready"
          ? t("Reserved: a copy is waiting for you at {branch}.", { branch: where })
          : reservation?.status === "in_transit"
            ? t("Reserved: a copy is on its way to {branch}.", { branch: where })
            : t("Reserved: you are number {position} in the queue.", { position: reservation?.queuePosition ?? "?" })
      );
    },
    onError: (error) => toast.error(getErrorMessage(error, t("Couldn't place the reservation."))),
  });

  if (!book.availability?.total) return null;
  if (!isSignedIn) {
    return (
      <button
        type="button"
        className="btn btn-outline-primary"
        onClick={() => navigate("/login", { state: { from: location.pathname, notice: msg("Sign in to reserve books.") } })}
      >
        <i className="bi bi-bookmark-plus me-2" aria-hidden="true"></i>{t("Sign in to reserve")}
      </button>
    );
  }
  if (membership.isSuccess && !membership.data) {
    return (
      <p className="small text-muted mb-0">
        {t("To borrow or reserve, ask at any branch to link a library card to your account.")}
      </p>
    );
  }
  return (
    <form
      className="d-flex flex-wrap gap-2 align-items-end"
      onSubmit={(event) => {
        event.preventDefault();
        reserve.mutate();
      }}
    >
      <div>
        <label htmlFor="pickup-branch" className="form-label small mb-1">
          {t("Pick up at")}
        </label>
        <select
          id="pickup-branch"
          className="form-select form-select-sm"
          value={pickupBranch}
          onChange={(event) => setPickupBranch(event.target.value)}
          required
        >
          <option value="">{t("Choose a branch…")}</option>
          {branches.map((branch) => (
            <option key={branch._id} value={branch._id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-outline-primary btn-sm" disabled={!pickupBranch || reserve.isPending}>
        {reserve.isPending ? (
          <Spinner label={t("Reserving")} />
        ) : (
          <>
            <i className="bi bi-bookmark-plus me-1" aria-hidden="true"></i>{t("Reserve")}
          </>
        )}
      </button>
    </form>
  );
}

function Metadata({ book }) {
  const rows = [
    ["ISBN", book.isbn],
    [msg("Edition"), book.edition],
    [msg("Publisher"), book.publisher?.name],
    [msg("Published"), book.publicationYear],
    [msg("Language"), book.language],
    [msg("Pages"), book.pageCount],
  ].filter(([, value]) => value);
  if (!rows.length && !book.subjects?.length) return null;
  return (
    <>
      <h2 className="h5 mt-4">{t("Details")}</h2>
      <dl className="row small mb-2" style={{ maxWidth: 520 }}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="col-4 text-muted fw-normal">{t(label)}</dt>
            <dd className="col-8 mb-1 text-capitalize">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {book.subjects?.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mb-2" aria-label={t("Subjects")}>
          {book.subjects.map((subject) => (
            <Link key={subject} to={`/?q=${encodeURIComponent(subject)}`} className="badge badge-soft text-decoration-none">
              {subject}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function BookRow({ title, books }) {
  if (!books?.length) return null;
  return (
    <section className="mt-5" aria-label={title}>
      <h2 className="h5 mb-3">{title}</h2>
      <div className="row row-cols-2 row-cols-md-4 row-cols-lg-6 g-3">
        {books.map((item) => (
          <div className="col" key={item._id}>
            <BookCard book={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const { data: book, isLoading, error, refetch } = useBookQuery(bookId);
  const { data: branches } = useActiveBranches();
  const editions = useEditions(bookId);
  const related = useRelatedBooks(bookId);
  const { addToCart, pendingId } = useAddToCart();
  const [quantity, setQuantity] = useState(1);

  const title = book ? formatTitle(book.bookTitle) : t("Book");
  const isSoldOut = book?.quantity <= 0;
  const forSale = book?.isForSale !== false;

  return (
    <div className="container py-4">
      <Helmet>
        <title>{`${title} · BookSaw`}</title>
      </Helmet>

      <nav aria-label={t("Breadcrumb")} className="mb-4">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item">
            <Link to="/catalog">{t("Catalogue")}</Link>
          </li>
          {book?.category?._id && (
            <li className="breadcrumb-item">
              <Link to={`/catalog?category=${book.category._id}`} className="text-capitalize">
                {book.category.name}
              </Link>
            </li>
          )}
          <li className="breadcrumb-item active" aria-current="page">
            {title}
          </li>
        </ol>
      </nav>

      {isLoading ? (
        <DetailsSkeleton />
      ) : error || !book ? (
        <ErrorState
          message={error ? getErrorMessage(error, t("We couldn't load this book.")) : t("This book could not be found.")}
          onRetry={error ? refetch : undefined}
        />
      ) : (
        <>
          <div className="row g-4 g-lg-5">
            <div className="col-md-5 col-lg-4">
              <BookCover src={book.image} alt={t("Cover of {title}", { title })} className="details-cover" />
            </div>
            <div className="col-md-7 col-lg-8">
              {book.category?.name && <span className="badge badge-soft mb-2">{book.category.name}</span>}
              <h1 className="mb-1">{title}</h1>
              <p className="text-muted fs-5 mb-3">{t("by {author}", { author: formatName(book.author) })}</p>

              <section className="mb-4" aria-labelledby="borrow-title">
                <h2 id="borrow-title" className="h5 d-flex flex-wrap align-items-center gap-2">
                  {t("Borrow from the library")} <AvailabilityNote availability={book.availability} className="fw-normal" />
                </h2>
                <BranchAvailability availability={book.availability} branches={branches} />
                <ReservePanel book={book} branches={branches} />
              </section>

              {forSale && (
                <section className="mb-4" aria-labelledby="buy-title">
                  <h2 id="buy-title" className="h5">
                    {t("Buy your own copy")}
                  </h2>
                  <div className="d-flex align-items-baseline gap-3 mb-3">
                    <BookPrice book={book} className="fs-3" />
                    {book.quantity <= LOW_STOCK_THRESHOLD ? (
                      <StockNote quantity={book.quantity} />
                    ) : (
                      <span className="stock-note text-success">{t("In stock")}</span>
                    )}
                  </div>
                  {!isSoldOut && (
                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <QuantityStepper
                        value={quantity}
                        max={book.quantity}
                        onChange={(next) => setQuantity(Math.min(Math.max(next, 1), book.quantity))}
                      />
                      <button
                        type="button"
                        className="btn btn-primary px-4"
                        onClick={() => addToCart(book, quantity)}
                        disabled={pendingId === book._id}
                      >
                        {pendingId === book._id ? (
                          <Spinner label={t("Adding")} />
                        ) : (
                          <>
                            <i className="bi bi-bag-plus me-2" aria-hidden="true"></i>{t("Add to cart")}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </section>
              )}

              <h2 className="h5 mt-4">{t("About this book")}</h2>
              <p className="text-muted" style={{ maxWidth: "65ch", whiteSpace: "pre-line" }}>
                {book.description}
              </p>
              <Metadata book={book} />
            </div>
          </div>
          <BookRow title={t("Other editions")} books={editions.data} />
          <BookRow title={t("You might also like")} books={related.data} />
        </>
      )}
    </div>
  );
}
