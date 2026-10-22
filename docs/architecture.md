# Architecture, conventions and compatibility notes

## Overview

```text
browser ──► web (nginx :8080) ──/api/*──► api (Express :3000) ──► MongoDB (replica set)
               │ static React build                  ├──► uploads volume (covers, digital files, documents)
               └ SPA fallback to index.html          ├──► Cloudinary (optional: book covers)
                                                     ├──► Stripe (optional: card checkout, refunds, webhook)
                                                     └──► Claude API (optional: catalogue assistant)

worker (same image, node src/worker.js) ──► MongoDB ──► Gmail SMTP (queued emails, retries)
                                           └ scheduled jobs: hold expiry, due-soon/overdue/membership reminders
```

The system is a **modular monolith**: one API process (scaled horizontally if needed),
one worker process, one database. Modules talk to each other through services and
repositories in the same process; there are no internal network calls.

In development the browser talks to the CRA dev server (`:3000`) and directly to the API
(`:4000`); in production everything is same-origin through nginx.

### API (`apps/api`)

Object-oriented, layered, with constructor dependency injection:

```text
routes ──► Controller ──► Service ──► Repository ──► Mongoose model
(router     (HTTP only:     (business     (all queries;
 factory)    req/res,        rules,        extends
             status codes)   orchestration) BaseRepository)
                                 │
                                 └──► infrastructure: StripePaymentGateway,
                                      CloudinaryImageStorage, GmailMailer
```

| Layer | Files | Responsibility | May depend on |
| --- | --- | --- | --- |
| Routes | `<entity>.routes.js` (`createXRouter({ xController, authGuard })`) | URL → middleware chain (auth, `validate(XDto)`, upload) → controller method | controller, `AuthGuard`, request DTOs |
| DTOs | `<entity>.dto.js` | Request DTOs: Joi schema + typed, whitelisted input. Response DTOs: the fields that leave the API | `core/dto.js` |
| Controller | `<entity>.controller.js` (`class XController`) | Pass `req.dto` to one service method, choose status code and response shape — no business rules, validation, coercion or configuration | its service |
| Service | `<entity>.service.js` (`class XService`) | Business rules, multi-step workflows; takes request DTOs, returns response DTOs; throws `HttpError` subclasses | repositories and infrastructure **passed to its constructor** |
| Repository | `<entity>.repository.js` (`class XRepository extends BaseRepository`) | **Every** database read and write for one model, including multi-step operations such as all-or-nothing stock reservation; returns plain objects | its Mongoose model |

- **SOLID in practice:**
  - *Single responsibility* — `AuthService` (register, login), `EmailConfirmationService`
    (confirmation tokens, email, confirm/resend) and `UserService` (user administration)
    are separate; order status rules live in `OrderPolicy` (`modules/orders/order-policy.js`).
  - *Dependency inversion / open–closed* — `OrderService` depends on a payment **port**
    (`modules/orders/payment-gateway.js`: `createCheckout`, `parseWebhookEvent` →
    `PAYMENT_OUTCOMES`). `StripePaymentGateway` is one adapter; it alone knows Stripe's
    line-item format, minor units and event types. Another provider is a new adapter
    wired in `container.js`, with no change to the order domain.
  - Error-status mapping is a rule table (`STATUS_RULES` in `error-handler.js`), and
    `createErrorHandler({ isProduction })` / `createApp(container)` receive configuration
    instead of reading globals — only `server.js` and `container.js` read `env`.
  - Repositories keep their model private (`#model`) and build every query from
    `BaseRepository` primitives (`findMany`, `updateWhere`, `bulkWrite`, …).
- **No duplication:** request DTOs carry exactly their schema's keys (no hand-written
  copies), single-id DTOs come from `objectIdParamDto(name)`, response DTOs declare
  `fields`/`nested`, `HttpError` subclasses declare only `status`/`defaultMessage`,
  `ensureFound()` replaces repeated not-found checks, and `authGuard.signedIn()` /
  `requirePermission(...)` name the access levels. Checked with jscpd (0 clones at the default
  thresholds across API source, API tests and the web app).
- **Composition root:** `src/container.js` is the only place that instantiates concrete
  classes and wires them together. `createApp(container)` mounts the routers;
  `server.js` builds the container, connects `container.database` and listens.
  To swap an implementation (e.g. another payment provider), change it there.
- **Encapsulation:** collaborators are stored in private `#fields`; controller handlers are
  arrow-function class fields, so they can be passed to Express without `bind`.
- **DTOs** (`src/core/dto.js`, `modules/*/<entity>.dto.js`):
  - *Request DTOs* (`CreateBookDto`, `AddToCartDto`, …) extend `RequestDto`: a static Joi
    `schema` plus a constructor that copies only the declared fields. `validate(XDto)`
    validates the merged body/params/query, applies Joi conversion and defaults
    (`"3"` → `3`, trimming, `paymentType` → `"cash"`) and sets `req.dto`. Fields a client
    adds (e.g. `totalLikes`, `image` URLs, `couponName`) never reach a service.
  - *Response DTOs* (`BookResponseDto`, `OrderResponseDto`, …) extend `ResponseDto` and
    whitelist the fields that leave the API. Services return them, never Mongoose documents.
  - The Stripe webhook is the one handler that reads `req.body` directly: the signature
    covers the raw bytes.
- **Database access lives only in repositories.** Repositories resolve plain objects
  (`.lean()` reads, `toObject()` after create), so services and controllers receive data
  they cannot save or mutate in the database. There is no generic `save()`; writes are
  intention-revealing, atomic operations — e.g. `CartRepository.addItem` (`$push`),
  `incrementItemQuantity` (positional `$inc`), `removeItem` (`$pull`),
  `BookRepository.reserveStock` (conditional `$inc` per item, rolled back if any book is
  short) and `releaseStock` (one `bulkWrite`). Services decide *what* should happen and
  coordinate across repositories (e.g. release reserved stock if creating the order
  fails); repositories decide *how* it is done in MongoDB. Shared constants live in
  `order-statuses.js` and `roles/permissions.js`, so services never import model files.
- **Thin controllers:** a controller method extracts input from `req`, awaits exactly one
  service call and maps the result to a response. The only branches left choose the
  response form from facts the service reports (redirect vs JSON after email confirmation,
  `201 newCart` vs `200 cart`, Stripe `url` vs cash `order`). Request-derived values that
  services need (the API's public base URL) come from `src/core/http-request.js`.
- **Errors:** services throw `NotFoundError`, `BadRequestError`, `ConflictError`, … from
  `src/core/http-errors.js` (all extend `HttpError` with a `status`; optional `details`
  are merged into the JSON body, which keeps legacy fields such as `error`). `globalErrorHandler`
  maps them, plus Mongoose cast/validation errors (400), JWT errors (401) and duplicate
  keys (409).
- **Authorization (RBAC):** routes declare the permission they need,
  `authGuard.requirePermission(PERMISSIONS.BooksManage)`; the guard resolves the user's role
  through `RoleService.permissionsFor()` on every request. The built-in `Admin` (all
  permissions) and `User` (none) roles live in code (`roles/system-roles.js`) and never
  touch the database; custom roles are documents in `roles` and users reference a role by
  name. `RoleService.assertCanGrant()` stops privilege escalation: nobody grants or removes
  a permission they lack, whether by editing a role or by changing an account's role.
- **Category → books (one-to-many):** `books.category` is an ObjectId reference
  (indexed); `Category` declares a `books` virtual. `BookRepository` always populates
  `{_id, name}`, counts books per category (one aggregation) and a category with books
  cannot be deleted. Books saved when the category was a name are re-linked at startup by
  `linkLegacyBookCategories()` (idempotent; creates a missing category instead of
  orphaning a book).
- **Security helpers** are classes too: `PasswordHasher` and `JwtTokenService` (two
  instances: login tokens signed with `TOKEN_SIGNATURE`, email tokens with `EMAIL_TOKEN`).
- **Stock:** `book.quantity` is stock. `OrderService` reserves it atomically per item
  (`BookRepository.decrementStock`, a conditional `$inc`) and releases it on failure,
  cancellation and expired checkouts.
- **Testing:** service tests construct a service with fake collaborators
  (`tests/services.test.js`); HTTP tests start the real app and stub methods on the
  container's instances (`tests/helpers.js`).

### Library domain (API)

**Modules** (`apps/api/src/modules/`): `books` (bibliographic records = editions), `authors`,
`publishers`, `categories`, `copies` (physical items), `branches` (branches, rooms, shelves),
`members` (members, membership types, membership history), `circulation` (loans,
reservations, the copy allocator), `finance` (fines, payments, the payment webhook
dispatcher), `transfers`, `inventory` (stocktakes), `acquisitions` (suppliers, purchase
orders), `facilities` (rooms, bookings, events), `digital`, `discovery` (catalogue search,
related titles), `assistant`, `notifications` (outbox + reminders), `reports`, `audit`,
`settings`, `roles`, `users`, `auth`, plus the original shop modules `cart` and `orders`.

**Data model.**

```text
Category 1─* Book (edition: ISBN unique, workKey groups editions) *─* Author ; Book *─1 Publisher
Book 1─* Copy (barcode unique, status, condition, cost) *─1 Branch ; Copy *─1 Location (shelf in a room)
MembershipType 1─* Member *─1 Branch (home) ; Member 0..1─1 User (self-service)
Copy 1─* Loan *─1 Member         (unique index: one ACTIVE loan per copy)
Book 1─* Reservation *─1 Member  (unique index: one OPEN reservation per member and title)
Loan 1─* Fine *─1 Member         (unique index: one overdue/lost/damaged fine per loan)
Payment *─1 Member, allocations → Fines ; refunds embedded
Copy 1─* Transfer (unique index: one open transfer per copy, history embedded)
Supplier 1─* PurchaseOrder (lines, deliveries → created copies, documents)
Branch 1─* Room 1─* RoomBooking ; Event *─1 Room? ; Event 1─* EventRegistration
AuditLog, Setting, Notification (outbox, dedupe key unique), Counter, JobLock, Migration
```

**State machines** live next to the models (`copy-statuses.js`, `circulation-statuses.js`,
`finance-statuses.js`, `transfer.model.js`, `acquisition.model.js`) and every transition is
a *guarded* update (`updateWhere({ _id, status: <expected> }, …)`): if another request got
there first, nothing changes and the service answers `409`.

**Transactions and concurrency.** Multi-document workflows (checkout, return, renew,
reservations, transfers, payments, refunds, deliveries, stocktake reconciliation, room
bookings) run in `TransactionRunner.run()` (MongoDB transactions, retried by the driver on
transient conflicts). The active session travels through `AsyncLocalStorage`
(`core/transaction-context.js`), so every repository call inside the callback joins the
transaction without passing a session around. Three techniques combine:

1. *Guarded transitions* on the copy/loan/reservation/payment (no double lending, no double processing).
2. *Unique partial indexes* as the last line of defence (active loan per copy, open reservation per member+title, one fine per loan+type, one open transfer per copy, one open stocktake per branch).
3. *Serialising touches*: a checkout or reservation first increments `members.circulationVersion`, a room booking `rooms.bookingVersion`. Two concurrent transactions for the same member/room then write-conflict; the driver retries the loser, which now sees the first one's loan/booking — so loan limits and room overlaps cannot be raced. The integration tests prove each case with concurrent requests.

Identifiers that must never collide (barcodes, member numbers, receipts, PO numbers) come
from `SequenceGenerator` (one atomic `$inc` per number), drawn *outside* transactions so
counters never become a conflict hotspot (gaps are harmless).

**Where a returned copy goes** is decided in one place, `CopyAllocator.release()`: the
oldest reservation picking up at this branch, else (cross-branch pickup allowed) the oldest
anywhere — by transfer — else back on the shelf (sent home first if `returnToHomeBranch`).
Returns, cancelled/expired holds and received transfers all call it.

**Authorization** is two-dimensional: permissions (`requirePermission(...)` on routes) and
branch scope (`req.access`, an `AccessContext`, passed to services, which call
`assertBranch()` / `branchFilter()`). A role's `branchScope` is `all` or `assigned`
(`users.branches`). Nobody can grant a permission or the `all` scope they do not have.

**Policies** are data, not code: `settings` (validated by `library-settings.js`, cached
30 s, optimistic `version`) and `membership-types`. Defaults never charge fines — the
library decides its own amounts.

**Background work** uses MongoDB, not new infrastructure: notifications are written in
the same transaction as the event (outbox, unique `dedupeKey`), and `worker.js` delivers
emails (lease-based claiming, 5 attempts with backoff) and runs scheduled jobs. A
`JobScheduler` lease per job lets several workers run without doing a job twice. No Redis
or message broker is needed at this scale; the boundaries (`NotificationService`,
`JobScheduler`) are where one would plug in if that changes.

**Integrations behind ports:** payments (`StripePaymentGateway`: hosted checkout,
refunds, verified webhooks with timeouts/retries), files (`LocalFileStorage` public/private
areas; `CloudinaryImageStorage` for covers when configured), mail (`GmailMailer` with
timeouts, `LogMailer` in development/tests), search (`MongoCatalogSearch` — a dedicated
engine would implement the same `search()`), AI (`ClaudeCatalogModel`, optional).

**Migrations** (`src/migrations/`, `npm run migrate`) are ordered, recorded in the
`migrations` collection, run under a lock, and only add data or indexes. In production
Mongoose `autoIndex` is off; the first migration creates every index. The API warns at
start-up when migrations are pending; it never runs them by itself.

### Web (`apps/web`)

- **Feature modules** (`src/modules/<feature>/`) hold pages (`*Page.jsx`), their child
  components (e.g. `BookForm`, `BookList`, `CartItemCard`, `OrderForm`), the feature's API
  calls (`*.service.js`) and validation. Pages coordinate; components render; services
  talk to the API. Pages never call axios directly.
- **Design system** (`src/styles/theme.css`): brand tokens on `:root` (burgundy `#630E2B`,
  shared with the confirmation email; warm paper background; serif headings) mapped onto
  Bootstrap's CSS variables, so stock Bootstrap components are on-brand. No other global
  stylesheets; no Bootstrap JavaScript (menus, modals and collapse are React state).
- **UI kit** (`src/components/ui/`): `toast` + `<Toaster />` (non-blocking, aria-live
  notifications instead of `alert()`), `confirm` + `<ConfirmDialog />` (accessible dialog
  instead of `window.confirm`), `Modal`, `FormField`/`PasswordField` (labels, inline errors,
  `aria-describedby`), `StatePanel`/`ErrorState` (empty/error states with actions),
  `BookCover` (placeholder for missing/broken images), `Spinner`.
- **Cart data** (`cart.queries.js`) is shared by the header badge, add-to-cart buttons and
  the cart page through the query cache. Prices are formatted in `lib/format.js` in the currency the
  API charges (`REACT_APP_CURRENCY`, default `EGP`); stored-lowercase titles and authors are
  displayed in title/name case.
- **UX conventions:** browsing is public (buying and admin need an account); catalogue
  search/category/sort live in the URL; every request has loading, empty and error states;
  destructive actions ask for confirmation; results are reported with toasts; forms
  validate inline with human-readable messages. Verified with axe-core (WCAG 2.1 AA + best
  practices: 0 violations on every page and interactive state) at 1280px and 390px.
- **Shared hooks** (`src/hooks/`): `useForm(initialValues, options)` — controlled inputs
  (incl. files) plus the validate → inline errors → submit lifecycle.
- Categories come from `GET /category` (with `bookCount`), so the API is the single source.
- **`lib/api-client.js`** is the single axios instance; it attaches
  `Authorization: <BEARER_KEY><token>` and `getErrorMessage()` turns API errors into UI text.
- **State management** is split by where the truth lives:
  - **Server state → TanStack Query** (`lib/query-client.js`, `modules/*/*.queries.js`).
    Books, a book's details, categories, users, roles, the current user's permissions and the cart are cached queries; every
    write is a mutation that updates or invalidates the cache.

    | Hook | Key | Behaviour |
    | --- | --- | --- |
    | `useBooksQuery`, `useBookQuery(id)` | `["books", "list"]`, `["books", "detail", id]` | details show the catalogue's cached copy as placeholder data |
    | `useSaveBook`, `useDeleteBook` | — | invalidate `["books"]` |
    | `useCategoriesQuery`, `useSaveCategory`, `useDeleteCategory` | `["categories"]` | saving also invalidates `["books"]` (books show the name) |
    | `useCurrentUserQuery`, `usePermissions` | `["me", userId]` | `GET /auth/me`; permissions come from here, not the JWT, so role changes apply without signing in again |
    | `useUsersQuery`, `useChangeUserRole` | `["users"]` | changing a role also invalidates `["roles"]` (user counts) |
    | `useRolesQuery`, `usePermissionCatalogue`, `useSaveRole`, `useDeleteRole` | `["roles", …]` | the catalogue is `staleTime: Infinity` |
    | `useCartQuery(select)`, `useCartCount` | `["cart", userId]` | per user; disabled when signed out; `select` derives count/subtotal |
    | `useAddCartItem`, `useRemoveCartItem`, `useClearCart` | — | remove/clear are optimistic with rollback |
    | `usePlaceOrder` | — | empties the cached cart, invalidates `["books"]` (stock changed) |

    Defaults: data is fresh for 30s; failed reads retry once, never on 4xx. Services are
    always called through wrappers so they never receive React Query's context argument.
    `useForgetCartOnSignOut` drops the previous user's cart from the cache (also when
    signing out in another tab). Devtools load only in development.
  - **Client state → Zustand**: `auth.store.js` (the session, mirrored from the stored
    JWT and synced across tabs), `toast.store.js` (`toast.success()` + `<Toaster />`) and
    `confirm.store.js` (`await confirm()` + `<ConfirmDialog />`). Components subscribe via
    selectors (`selectUser`, `selectIsSignedIn`) so they re-render only for their slice.

  Tests give every render a fresh retry-less `QueryClient` and reset Zustand stores from
  inside each test file (not `setupTests.js`, which runs before `jest.mock`).
- `ProtectedRoute` guards signed-in routes and accepts `permissions` (any of them must be
  granted). `/dashboard` is an admin area (`modules/admin/`): `ADMIN_SECTIONS` maps each
  section (books, categories, users, roles) to the permissions its API endpoints require,
  so tabs, routes and the header link show only what the user's role allows.
- **Routing** is defined once in `app/routes.jsx`; `App` creates a hash router (deep links
  work on GitHub Pages and nginx). Tests inject a memory router.
- **Config** is build-time (`REACT_APP_API_URL`, `REACT_APP_BEARER_KEY`) with the previously
  hard-coded values as fallbacks, so the GitHub Pages build is unchanged.

### Web: library screens

- **Three areas:** the public catalogue (`/`, `/book/:id`, `/digital`, `/events`), the member
  portal (`/account/*`: loans, reservations, fines and online payment, notifications, room
  bookings) and the staff dashboard (`/dashboard/*`, a grouped sidebar). Each dashboard
  section declares the permissions of its API endpoints (`modules/admin/admin-sections.js`);
  the sidebar, routes and header links show only what the role grants, and the API enforces
  the same rules.
- **Shared building blocks:** `lib/resource.js` (`usePagedQuery` for `{data, meta}` lists with
  the previous page kept while the next loads, `useDataQuery`, `useApiMutation` with
  invalidation + toasts), `hooks/useListState.js` (filters reset to page 1),
  `components/ui/DataTable`, `Pagination`, `PageHeader`, `StatusBadge`.
- **Money** from the library endpoints is in minor units: `formatMoney()` to display,
  `toMinorUnits()` for staff input. Shop prices keep their original format.
- **Protected files** (digital publications, purchase documents, CSV exports) are fetched
  with the session token as blobs and opened through object URLs — never bare links.
- **Tests** render single pages with `test-utils/render-page.jsx` (`renderPage` + `fakeApi`);
  `app/App.test.jsx` covers the shell, routing and access rules.

### Why no `packages/shared`

The only logic duplicated across apps is the signup/login validation rules (Joi in both).
Create React App cannot import code from outside `src/` without ejecting, so a shared
package would need extra tooling for one small schema. Each copy points to the other in a
comment instead.

## Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Folders | lowercase, kebab-case, plural for collections of entities | `modules/books`, `middleware` |
| API module files | `<entity>.<role>.js` | `book.routes.js`, `order.service.js`, `user.repository.js` |
| API classes | PascalCase, named after their role | `OrderService`, `BookRepository`, `StripePaymentGateway` |
| DTO classes | `<Action><Entity>Dto` for requests, `<Entity>ResponseDto` for responses | `CreateOrderDto`, `CartResponseDto` |
| Other API files | kebab-case | `error-handler.js`, `confirmation-email.template.js` |
| React components / pages | PascalCase file = component name; pages end in `Page` | `CartPage.jsx`, `RootLayout.jsx` |
| Hooks | `useX.js` | `useBooks.js` |
| Web services / utilities | `<feature>.service.js`, kebab-case | `cart.service.js`, `api-client.js` |
| Tests | `*.test.js(x)`; API in `apps/api/tests/`, web colocated (CRA only finds tests in `src/`) | `auth.test.js`, `App.test.jsx` |
| Functions / variables | camelCase | `reserveStock`, `listBooks` |
| Constants / enums | UPPER_SNAKE_CASE | `USER_ROLES`, `ORDER_STATUSES` |
| Environment variables | UPPER_SNAKE_CASE, vendor-prefixed where applicable | `STRIPE_SECRET_KEY` |

Persisted and public identifiers were **not** renamed even where they break these rules
(e.g. `bookTitle`, `cPassword`, `DOB`, `confirmEmail`, routes such as `/book/edit/:id`,
`/auth/NewConfirmEmail/:token`, the `book` key in `GET /book`, the `userToken` storage key,
role values `Admin`/`User`, status `waitPayment`), because clients and stored documents
depend on them.

## Rename map

| Before | After |
| --- | --- |
| `book_Store/` (repo) | `apps/api/` |
| `bookStore_/` (repo) | `apps/web/` |
| `book_Store/index.js` | `apps/api/src/server.js` |
| `src/app.router.js` (`initApp`) | `src/app.js` (`createApp`) |
| `DB/modules/*Model.js` | `src/modules/<domain>/<entity>.model.js` |
| `src/utils/{cloudinary,email,payment}.js` | `src/infrastructure/{cloudinary-image-storage,gmail-mailer,stripe-payment-gateway}.js` (classes) |
| `src/utils/errorHandling.js` | `src/middleware/error-handler.js` |
| `src/utils/multer.js` | `src/middleware/upload.js` |
| `src/middleware/auth.js` (`auth`) | `src/middleware/auth-guard.js` (`class AuthGuard`) |
| `src/middleware/validation.js` | `src/middleware/validate.js` (`validate(Dto)`) |
| `*.validation.js` / `BookValidation.js` (Joi schemas) | `<entity>.dto.js` (request + response DTO classes) |
| `src/utils/HashAndCompare.js` | `src/security/password-hasher.js` (`class PasswordHasher`) |
| `src/utils/GenerateAndVerifyToken.js` | `src/security/jwt-token-service.js` (`class JwtTokenService`) |
| `DB/connection.js` (`connectDB`) | `src/infrastructure/database.js` (`class Database`) |
| `src/modules/{Book,Category,order}` | `src/modules/{books,categories,orders}` |
| `registration.js`, `Book.js`, `category.js`, `cart.js`, `controller/order.js` | `*.controller.js` |
| `*Router.js` / `*.router.js` | `*.routes.js` |
| `*.endpoint.js` / `*.endPoint.js` | removed (role lists inlined in routes) |
| `BookSaw.postman_collection.json` | `docs/bookstore-api.postman_collection.json` |
| `Components/<Name>/<Name>.jsx` | `modules/<feature>/<Name>Page.jsx`, `layouts/`, `components/` |
| `Components/Rootlayout/` | `layouts/RootLayout.jsx` |
| `Components/Dashboard/Dashboard.jsx` (`BooksManager`) | `modules/books/BooksDashboardPage.jsx` |
| `Components/ErrorElement`, `Components/Offline` | `components/ErrorPage.jsx`, `components/OfflineWarning.jsx` |
| `Context/UserContext.jsx`, `Utils/Validation.js` | `modules/auth/auth.store.js` (Zustand), `modules/auth/auth.validation.js` |
| `Hooks/useRoute.js` | `modules/books/useBooks.js` |
| `css/normalize.module.css` | `styles/normalize.css` (no class selectors, so identical output) |
| `images/` | `assets/images/` |

Removed after verifying nothing referenced them: `BookStore_JSX/` and `build/` (committed
build output), 41 unused images, `src/js/` (jQuery template scripts), `src/icomoon/`,
`Utils/Token.js` (unused; called an unrelated API on import), `reportWebVitals.js`,
`.vscode/` C/C++ configs, empty `commetModel.js` and two empty stylesheets.

## Environment variable renames

Old names are still read (canonical name wins) and the API logs
`Deprecated environment variable names in use: ...` at startup.

| Canonical | Legacy (still accepted) |
| --- | --- |
| `MONGODB_URI` | `DB_LOCAL` |
| `STRIPE_SECRET_KEY` | `Secret_Key`, `SECRET_KEY` (the code used both — card orders and webhooks read different variables) |
| `STRIPE_WEBHOOK_SECRET` | `endpointSecret` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | `CLOUD_NAME` / `API_KEY` / `API_SECRET` |
| `FRONTEND_URL` | `FE_URL` |
| `NODE_ENV` | `MOOD=DEV` (→ development) |

New: `PORT` (default 3000), `REQUIRE_EMAIL_CONFIRMATION` (default `true`),
web build `REACT_APP_API_URL`, `REACT_APP_BEARER_KEY`.

## Behavior and API compatibility changes

Each change fixes a bug or a security problem; everything else keeps the original contract.

**Authorization (security).** The role check was commented out, so any signed-in user could
add/edit/delete books, and category create/update/delete and `GET /auth/user` (which
returned password hashes) needed no login at all. Now:

- Admin only: `POST /book/add`, `POST /book/edit/:id`, `DELETE /book/delete/:id`,
  `POST|PUT|DELETE /category…`, `GET /auth/user`, `PATCH /order/:id/delivered`.
- Any signed-in user: create/cancel orders (the old role map said Admin-only, which would
  have blocked customers had it been enforced), cart, like/unlike.
- **Action required:** promote the accounts that use the dashboard:
  `db.users.updateOne({email: "…"}, {$set: {role: "Admin"}})`.

**Status codes and payloads**

- Auth failures: missing/invalid bearer or token → `401` (were `400`/`404`/`500`); wrong role → `403`.
- Login: wrong password `401` (was `404`), unconfirmed email `403` (was `404`).
- Unknown routes: `404` JSON (was `200` text). Invalid ObjectIds: `400` (were `500`).
- Production 5xx responses no longer include the error message or stack trace.
- `GET /auth/user`: key `check` → `users`.
- Like/unlike: key `likeBook`/`unLikeBook` → `book` (these endpoints never worked before).
- `POST /book/edit/:id`: returns the *updated* book with `200` (was the old document with
  `201`) and no `existingCategory`.
- `POST /book/add` field-validation errors use the standard `validationErr` shape.
- `PUT /category/:id` with a name outside the options and `POST /book/add` without an
  image: `{message, error}` (the original `error` field is kept, `message` added).
- Responses are built from response DTOs: `__v`, the `likes` user-id array on books and the
  `_id` of cart line items are no longer returned; card orders return
  `session: {id, url}` instead of the full Stripe session object (which included
  customer details). Every field the web app reads is unchanged.
- Request strings are trimmed and numeric fields converted before they are stored.
- Stripe webhook with an invalid signature: `400` JSON `{message: "Webhook Error: …"}`
  (was plain text; Stripe only looks at the status code).
- `PATCH /order/:id/cancel` returns the order *after* cancellation (it returned the
  pre-cancellation snapshot).
- Stripe: success and cancel URLs are `FRONTEND_URL/#/cart` (were `/#/order` and
  `/order/cancel` on the API, neither of which existed).
- `PATCH /order/:id/delivered` now sets `delivered` (it set `canceled`).

**Data.** No migrations and no destructive changes. Schema changes are additive
(`users.phone`, `books.likes`); `books.changePasswordTime` was dropped from the schema only
(unused, existing values untouched). New emails are stored lowercase; login also matches
legacy mixed-case emails. Mongoose options that never took effect (`lower`, string
`min`/`max`) were removed, so validation behavior is unchanged.

**Web.** `/dashboard` requires the Admin role (matching the API) and admins get a header
link; the header shows "Cart" instead of a count that was always 0; footer links point at
real routes; `/profile` is routed; the non-functional "forget password" text was removed.
