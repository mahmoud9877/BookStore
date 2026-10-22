# API reference

Base URL: `http://localhost:4000` (Docker development), `/api` behind the production
nginx proxy, or the Vercel deployment.

Authenticated requests send `Authorization: <BEARER_KEY><jwt>` (the configured prefix
directly followed by the token from `POST /auth/login`).

Access levels: **public**, **user** (any signed-in account), or a **permission** such as
`books:manage` (the account's role must grant it; see [Roles and permissions](#roles-and-permissions)).
A missing permission returns `403`.

Unknown request fields are ignored; responses contain only documented fields (see the
response DTOs in `apps/api/src/modules/*/<entity>.dto.js`).

Errors are JSON: `{ "message": "..." }`. Validation failures return
`400 { "message": "validationErr", "validationErr": [ ...Joi details ] }`.
In production, 5xx responses only say `"Internal server error"`; stack traces are
included only when `NODE_ENV=development`.

**Status codes used throughout:** `400` invalid input or a rule that forbids the step
(e.g. "Overdue loans cannot be renewed"), `401` not signed in / deactivated account,
`403` missing permission, other branch, or a membership that may not borrow, `404` not
found, `409` conflict (duplicate, changed meanwhile, still in use), `413` upload too
large, `429` rate limited (`Retry-After` header), `503` optional integration not configured.

### Conventions of the library endpoints

The library modules (everything below [Library](#library) — plural paths) use one shape:

- A record: `{ "data": {...} }`. A collection: `{ "data": [...], "meta": { "page", "limit", "total", "pages" } }`.
- Collections take `?page=` (default 1), `?limit=` (default 20, max 100) and `?sort=` — a
  field name, `-field` for descending; only the fields listed per endpoint are accepted.
- Ids are MongoDB ObjectIds. Dates are ISO 8601.
- **Money** in fines, payments, settings, copy costs and purchase orders is an
  **integer in the currency's minor unit** (e.g. piastres: `1250` = 12.50 EGP). The
  currency is the `currency` setting. (Shop book prices keep their original major-unit numbers.)
- **Branch scope:** a role has `branchScope` `all` or `assigned`. Staff with `assigned`
  only see and change records of the branches on their account (`users.branches`);
  acting on another branch's record returns `403`.
- Sensitive writes are recorded in the audit log (actor, action, before/after, reason).
- The legacy endpoints above (`/auth`, `/book`, `/category`, `/cart`, `/order`, `/role`)
  keep their original paths and response shapes for existing clients.

## Service

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/` | public | Welcome text |
| GET | `/health` | public | `200 {status:"ok",database:"up"}` or `503` when MongoDB is disconnected |

## Auth — `/auth`

| Method | Path | Access | Body / response |
| --- | --- | --- | --- |
| POST | `/auth/signup` | public | `{userName (3–30), email, password (≥6), cPassword?, phone?}` → `201 {message:"Done", _id, token, refreshToken}` |
| POST | `/auth/login` | public | `{email, password}` → `{message:"Done", token, role}`. `404` unknown email, `403` email not confirmed, `401` wrong password |
| GET | `/auth/confirmEmail/:token` | public | Link from the confirmation email. Redirects to `FRONTEND_URL/#/login` when set |
| GET | `/auth/NewConfirmEmail/:token` | public | Long-lived link: confirms, or re-sends a fresh confirmation email |
| GET | `/auth/me` | user | `{user}`: the signed-in account plus `permissions` (what its role grants right now) |
| GET | `/auth/user` | `users:read` or `users:manage` | `{message:"done", users}` (password and code excluded) |
| PATCH | `/auth/user/:id/role` | `users:manage` | `{role}` → `{message, user}`. `404` unknown role, `400` for your own account, `403` if either the old or the new role has a permission you lack |

When `REQUIRE_EMAIL_CONFIRMATION=false`, new accounts are created already confirmed.

## Books — `/book`

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/book` | public | `{book: [...]}` newest first. Optional `?limit=&page=` pagination. Each book's `category` is `{_id, name}` |
| GET | `/book/:bookId` | public | `{message:"Done", book}` |
| POST | `/book/add` | `books:manage` | `multipart/form-data`: `bookTitle, author, description, price, category, quantity, image` (jpeg/png/gif). `category` is a category id (`404` if it does not exist) |
| POST | `/book/edit/:id` | `books:manage` | Same fields; `image` optional. Returns the updated book |
| DELETE | `/book/delete/:id` | `books:manage` | |
| PATCH | `/book/:bookId/like` | user | `400` if already liked |
| PATCH | `/book/:bookId/unlike` | user | `400` if not liked |

`quantity` is the number of copies in stock.

## Categories — `/category`

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
A category has many books; each book belongs to exactly one category.

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/category` | public | Array of `{_id, name, bookCount}`, sorted by name |
| GET | `/category/:id` | public | `{_id, name, bookCount}` |
| GET | `/category/:id/books` | public | `{books: [...]}`: the category's books, newest first |
| POST | `/category` | `categories:manage` | `{name}` (stored lowercase). `409` if the name is taken |
| PUT | `/category/:id` | `categories:manage` | `{name}`: renames; the category's books follow. `409` if the name is taken |
| DELETE | `/category/:id` | `categories:manage` | `409` while the category still has books |

## Cart — `/cart` (user)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/cart` | `{message:"Done", cart}`; `404` if the user has no cart yet |
| POST | `/cart/add` | `{bookId, quantity}`; rejects quantities above stock. `201 {newCart}` on first add, then `200 {cart}` |
| DELETE | `/cart/clear` | Empties the cart |
| DELETE | `/cart/:bookId` | Removes one book |

## Orders — `/order`

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/order` | user | `{address, phone (string or array), note?, paymentType: "cash"\|"card"}` (default cash). Orders the whole cart, reserves stock, empties the cart. Cash → `201 {order}`; card → `201 {session: {id, url}, url}` (Stripe Checkout) |
| PATCH | `/order/:orderId/cancel` | user (owner) | `{reason}`. Allowed while cash orders are `placed` or card orders are `waitPayment`; restores stock |
| PATCH | `/order/:orderId/delivered` | `orders:manage` | Allowed from `placed` / `onWay` |
| POST | `/order/webhook` | Stripe | Signature-verified raw body. `checkout.session.completed` → `placed`; `checkout.session.expired` / `async_payment_failed` → `rejected` and stock released |

Order statuses: `waitPayment`, `placed`, `onWay`, `delivered`, `canceled`, `rejected`.

## Roles and permissions

Every account has one role (`users.role`). A role grants a set of permissions:

The full list (with descriptions) is served by `GET /role/permissions`:
`books:manage, categories:manage, copies:manage, digital:manage, circulation:manage,
reservations:manage, members:read, members:manage, fines:manage, payments:manage,
inventory:manage, acquisitions:manage, branches:manage, facilities:manage, orders:manage,
reports:read, audit:read, settings:manage, users:read, users:manage, roles:manage`.

Starting staff roles created by the migrations (editable): **Librarian**, **Branch
Manager**, **Inventory Staff** (assigned branches) and **Finance Staff** (all branches).

The built-in roles live in code and cannot be edited or deleted: **Admin** has every
permission and **User** (every new account) has none. Admins create further roles, such
as a catalogue editor with only `books:manage` and `categories:manage`.
Permissions are looked up on every request, so a role change applies without signing in again.

Nobody can grant or take away a permission they do not hold themselves, whether
by editing a role or by changing an account's role. Nobody can change their own role.

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/role` | `roles:manage` or `users:manage` | `{roles: [{_id?, name, description, permissions, isSystem, userCount}]}`, built-in roles first |
| GET | `/role/permissions` | `roles:manage` or `users:manage` | `{permissions: [{key, label, description}]}` |
| POST | `/role` | `roles:manage` | `{name (2–40), description?, permissions: [...], branchScope? (all\|assigned, default assigned)}` → `201 {message, role}`. `409` if the name is taken (including Admin/User). Granting `all` needs `all` yourself |
| PUT | `/role/:id` | `roles:manage` | `{description?, permissions, branchScope?}`: replaces them. The name cannot change |
| DELETE | `/role/:id` | `roles:manage` | `409` while any account holds the role |

## Library

### Catalogue and discovery

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/catalog/search` | public | `?q=` (full text, or an ISBN) `category, author, publisher, isbn, subject, language, yearFrom, yearTo, available (bool), branch, sort (relevance\|title\|newest\|year\|available), page, limit (≤60)`. Each book has `availability: {total, available}` |
| GET | `/catalog/:bookId/related` | public | Up to `?limit=` titles sharing subjects, authors or category (catalogue data only — never other members' borrowing) |
| GET | `/book/:bookId` | public | Now also `availability: {total, available, byStatus, byBranch: {[branchId]: {total, available}}}`, `authors`, `publisher`, `isbn`, `edition`, `subjects`, `keywords`, `isForSale` |
| GET | `/book/:bookId/editions` | public | Other editions of the same title (same normalized title + first author) |
| POST | `/book/add`, `/book/edit/:id` | `books:manage` | Multipart. New optional fields: `isbn` (check digit verified, unique), `edition`, `publisher` (id), `publicationYear`, `language`, `pageCount`, `subjects`, `keywords` (comma-separated), `isForSale` (default true), `price`/`quantity` (shop only, default 0). `author` is comma-separated names; each becomes an Author record. The cover `image` is optional; without Cloudinary it is stored locally and served at `/uploads/book/...` |
| DELETE | `/book/delete/:id` | `books:manage` | `409` if the book has physical copies (withdraw them instead) |
| GET/POST/PATCH/DELETE | `/authors`, `/publishers` (+`/:id`) | read public, write `books:manage` | `{name, bio}` / `{name, website, country}`; `?search=`. Delete `409` while books reference it |
| POST | `/assistant/ask` | public, 10/min per IP | `{question}` → `{data: {answer, mode: "ai"\|"keyword", filters, recommendedIds, results}}`. See [AI assistant](#ai-assistant) |
| GET | `/assistant/status` | public | `{data: {ai: bool}}` |

### Copies (physical items)

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/copies` | `copies:manage`, `circulation:manage`, `inventory:manage` or `reservations:manage` | `?book, branch, status, search (barcode prefix), sort (barcode\|createdAt\|status)` |
| GET | `/copies/barcode/:barcode` | same | Scanner lookup |
| GET | `/copies/:id` | same | |
| POST | `/copies` | `copies:manage` | `{book, branch, location?, count (1–200), barcodes? (exactly count), condition, cost?, notes?}` → `201 {data: [copies]}`. Generated barcodes: `<BRANCH>-0000042` |
| PATCH | `/copies/:id` | `copies:manage` | `{location?, condition?, cost?, notes?}` — status and branch change only through workflows |
| POST | `/copies/:id/status` | `inventory:manage` or `copies:manage` | Manual adjustment `{status, reason}` (audited). Allowed: available→damaged/lost/missing/withdrawn, damaged→available/withdrawn/lost, missing→available/lost/withdrawn, lost→available/withdrawn. `on_loan`, `on_hold`, `in_transit` are set only by circulation/transfers |

Copy statuses: `available, on_loan, on_hold, in_transit, damaged, lost, missing, withdrawn`.

### Members

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/members/me` | user | The signed-in account's membership + `summary {activeLoans, overdueLoans, activeReservations, balance}`; `404` when none is linked |
| GET | `/members` | `members:read` or `members:manage` | `?search, status, kind, membershipType, homeBranch, expired, sort (name\|memberNumber\|expiresAt\|createdAt)` |
| GET | `/members/number/:memberNumber` | `circulation:manage`, `members:read/manage` | Desk lookup (any branch) |
| GET | `/members/:id`, `/members/:id/history` | `members:read/manage`, `circulation:manage` | Record + summary; membership events (joined, renewed, suspended, …) |
| POST | `/members` | `members:manage` | `{name, kind (individual\|student\|researcher\|institution), email?, phone?, address?, institution?, notes?, membershipType, homeBranch, userEmail?}` — `userEmail` links an existing sign-in account for self-service. Number `M-0000001`, expiry = today + the type's months |
| PATCH | `/members/:id` | `members:manage` | Any of the above |
| POST | `/members/:id/renew` | `members:manage` | Extends from today or the current expiry, whichever is later |
| POST | `/members/:id/suspend` | `members:manage` | `{reason}` (required) |
| POST | `/members/:id/reactivate`, `/members/:id/cancel` | `members:manage` | `{reason?}`; cancel `409` while items are on loan |
| CRUD | `/membership-types` | read: user, write: `settings:manage` | `{code, name, loanLimit, loanPeriodDays, maxRenewals, reservationLimit, membershipMonths, canAccessDigital, isActive}`. Delete `409` while members hold it |

### Circulation

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/loans/checkout` | `circulation:manage` | `{barcode, member (id or number), overrideReason?}`. Refused (`403`) for suspended/cancelled/expired members; `403` with the reasons when over the loan limit or the balance block — resend with `overrideReason` (≥5 chars, audited) to lend anyway. `409` if the copy is not available or is on hold for someone else. The desk must be at the copy's branch (or the hold's pickup branch) |
| POST | `/loans/return` | `circulation:manage` | `{barcode, branch? (the desk; default the copy's branch), damaged?, notes?}` → `{data: {loan, next: "held"\|"transfer"\|"shelved"\|"damaged", fine}}`. Charges the overdue fine (settings), then gives the copy to the next reservation, sends it home, or shelves it |
| POST | `/loans/:id/renew` | `circulation:manage` | Not when overdue, at the renewal limit, or (unless settings allow) while others wait for the title |
| POST | `/loans/:id/lost` | `circulation:manage` | `{reason?}` closes the loan, marks the copy lost, charges the lost fee (setting, else the copy's cost) |
| GET | `/loans` | `circulation:manage` or `members:read` | `?status, member, book, branch, overdue, from, to, sort (checkedOutAt\|dueAt\|returnedAt)` |
| GET | `/loans/me` | user | Own loans (`?status, page, limit`), with `accruedFine` (estimate if returned now) and `renewalsLeft` |
| POST | `/loans/me/:id/renew` | user | Self-service renewal (same rules) |
| POST | `/reservations/me` | user | `{book, pickupBranch}`. Holds a shelf copy at once (or sends one from another branch if cross-branch pickup is allowed); otherwise queues. `409` duplicate or already borrowed; `403` limit/standing |
| GET | `/reservations/me` | user | With `queuePosition` while waiting and `expiresAt` once ready |
| POST | `/reservations/me/:id/cancel` | user | Releases an allocated copy to the next member |
| GET/POST | `/reservations` | `reservations:manage` (GET also `circulation:manage`) | List (`?status, book, member, pickupBranch`); place for a member `{member, book, pickupBranch}` |
| POST | `/reservations/:id/cancel` | `reservations:manage` | `{reason?}` |

Loan statuses: `active, returned, lost`. Reservation statuses: `waiting → in_transit → ready → fulfilled`, or `cancelled` / `expired` (ready holds expire after `holdPickupDays`).

### Fines and payments

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/fines/me` | user | `{data: {fines, balance, currency}}` |
| GET | `/fines` | `fines:manage`, `payments:manage` or `members:read` | `?member, status (outstanding\|paid\|waived), type (overdue\|lost\|damaged\|manual), from, to`. Each fine has `balance` |
| POST | `/fines` | `fines:manage` | Manual charge `{member, amount, reason}` |
| POST | `/fines/:id/waive` | `fines:manage` | `{amount? (default: the whole balance), reason}` (audited) |
| GET | `/payments`, `/payments/me` | `payments:manage` / user | `?member, status, method, from, to` |
| POST | `/payments` | `payments:manage` | Cash at a desk: `{member, amount, fines? (ids), idempotencyKey?}` (or `Idempotency-Key` header — a retried request returns the first payment). Applied to the listed fines, else oldest first; `400` if more than owed. Returns `receiptNumber` |
| POST | `/payments/me/checkout` | user | Card payment of outstanding fines (`{fines?}`): the amount is computed on the server. → `{data: {payment, url}}` (Stripe Checkout). `503` if card payments are not configured |
| POST | `/payments/:id/refund` | `payments:manage` | `{amount, reason}`; card refunds go through Stripe first. Reopens the paid fines (audited) |
| POST | `/payments/webhook` (and `/order/webhook`) | Stripe | Signature-verified. A card payment becomes `succeeded` only here, exactly once (duplicate deliveries are ignored) |

Payment statuses: `pending, succeeded, failed, partially_refunded, refunded` — our own record, separate from the provider's.

### Inventory, transfers and acquisitions

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET/POST | `/transfers` | `inventory:manage` | List (in/out of your branches; `?status, reason, fromBranch, toBranch`); create `{barcode, toBranch, note?, ship?}` (`requested`, or `in_transit` with `ship: true`) |
| POST | `/transfers/:id/ship` | `inventory:manage` (source branch) | `requested → in_transit` |
| POST | `/transfers/:id/receive` | `inventory:manage` or `circulation:manage` (destination) | Re-homes rebalanced stock; a reservation's copy becomes its hold |
| POST | `/transfers/:id/cancel` | `inventory:manage` | An in-transit copy goes back to the source |
| GET/POST | `/stocktakes` | `inventory:manage` | Start `{branch, location?}` (one open per branch) |
| GET | `/stocktakes/:id` | `inventory:manage` | `progress {expected, scanned, missing[], foundAgain[], unexpected[]}` |
| POST | `/stocktakes/:id/scans` | `inventory:manage` | `{barcodes: [...] (≤500)}`; repeats are ignored |
| POST | `/stocktakes/:id/close` | `inventory:manage` | `{apply: true}` marks unfound copies `missing` and found missing/lost ones `available` (each audited) |
| CRUD | `/suppliers` | `acquisitions:manage` | |
| GET/POST | `/purchase-orders` | `acquisitions:manage` | Request `{branch, supplier?, lines: [{book? or title, isbn?, quantity, unitCost}], notes?}` |
| PATCH | `/purchase-orders/:id` | `acquisitions:manage` | Lines/supplier while `requested`/`approved` |
| POST | `/purchase-orders/:id/{approve,reject,cancel,order}` | `acquisitions:manage` | `order` needs a supplier and catalogued lines; assigns `PO-000001` |
| POST | `/purchase-orders/:id/deliveries` | `acquisitions:manage` | `{reference?, lines: [{line, quantity}]}` — adds the copies (cost, supplier, order) to the branch; over-delivery `400` |
| POST/GET | `/purchase-orders/:id/documents[/:documentId]` | `acquisitions:manage` | Upload (`file`: PDF, image, CSV, XLSX ≤20 MB) / download (private storage) |

### Branches, rooms and events

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/branches/active` | public | Pickup choices |
| CRUD | `/branches` | read: user, write: `branches:manage` | `{code, name, address, phone, email, isActive}`; delete `409` while it holds copies |
| CRUD | `/locations` | `branches:manage` (read also copies/inventory) | Rooms and shelves `{branch, type: room\|shelf, parent (room), code, name}` |
| CRUD | `/rooms` | read public, write `facilities:manage` | Bookable rooms `{branch, name, kind, capacity, features, isActive}` |
| GET | `/rooms/:id/availability?from&to` | public | Busy intervals (no member details) |
| GET/POST | `/rooms/bookings/me`, `POST /rooms/bookings/me/:id/cancel` | user (member) | `{room, startAt, endAt, purpose?}`. Policy: max hours, max days ahead, cancellation cutoff (settings). Overlaps `409` |
| GET/POST | `/rooms/bookings`, `POST /rooms/bookings/:id/cancel` | `facilities:manage` | Staff bookings (no policy limits) |
| GET | `/events/public` | public | Upcoming public events |
| CRUD | `/events`, `POST /events/:id/cancel` | `facilities:manage` | `{branch, room?, title, description, startAt, endAt, capacity, isPublic}`; a room is booked with the event |
| POST | `/events/:id/register`, `/events/:id/unregister`; GET `/events/me` | user (member) | Capacity enforced atomically |

### Digital library

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/digital` | public (optional sign-in) | Published titles; `canOpen` per viewer. Staff with `digital:manage`: `?includeUnpublished=true` |
| GET | `/digital/:id/file` | depends on the publication | Streams the file (`Cache-Control: private, no-store`). `access`: `public`, `members` (good standing + type with digital access), `membership_types` (listed types), `staff`. Expired licences are not served. Every open is logged |
| POST | `/digital` | `digital:manage` | Multipart: `file` (PDF, EPUB, MP3, MP4 ≤200 MB), `title, authors, description, book, access, membershipTypes, allowDownload, licenseType (public_domain\|open_license\|licensed\|owned), licenseHolder, licenseExpiresAt, licenseTerms, isPublished` |
| PATCH/DELETE | `/digital/:id` | `digital:manage` | |

### Notifications

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/notifications/me` | user | In-app inbox `?page, limit, unreadOnly` → `{data, meta, unread}` |
| POST | `/notifications/me/read` | user | `{ids?}` (all when omitted) |
| GET | `/notifications/stats` | `settings:manage` or `reports:read` | Delivery counts per channel and status |

Members are notified (in-app if their membership is linked to an account, and by email
if they have an address) about: due soon, overdue (first day, then weekly), reservation
ready/expired, membership expiring, fines issued, payments received. Templates are in
settings. Emails are sent by the worker with retries (5 attempts, exponential backoff);
every event has a dedupe key, so nothing is sent twice.

### Reports, audit and settings

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/reports/summary` | `reports:read` | Headline counts |
| GET | `/reports/{top-titles,inventory,overdue,fines,memberships,reservations,acquisitions,branches}` | `reports:read` | `?from, to, branch, page, limit (≤500), order (most\|least, top-titles), format=csv` (CSV where tabular; overdue is streamed) |
| GET | `/reports/staff-activity` | `audit:read` | Actions per staff member in the period |
| GET | `/audit-logs` | `audit:read` | `?action, entity, entityId, actor, from, to` |
| GET/PUT | `/settings` | `settings:manage` | PUT sends the whole object plus the `version` read (`409` if someone saved meanwhile). Sections: `currency`, `circulation {blockBorrowingAboveBalance, allowRenewalWhenReserved, returnToHomeBranch}`, `reservations {holdPickupDays, allowCrossBranchPickup}`, `fines {overduePerDay, graceDays, maxOverduePerLoan, lostItemFee, damagedItemFee}`, `notifications {emailEnabled, dueSoonDays, membershipExpiryDays, templates}`, `rooms {maxBookingHours, maxAdvanceDays, cancellationCutoffHours}` |

**Defaults** (until an administrator changes them): no overdue, lost-item flat or damage
fees (`0`/`null`), hold pickup 3 days, cross-branch pickup allowed, copies return home,
due-soon reminder 2 days before, membership reminder 14 days before, rooms bookable 4 h
at most and up to 30 days ahead. The first membership type (`STANDARD`: 5 loans, 14 days,
2 renewals, 5 reservations, 12 months) is a placeholder to edit.

### Users (staff accounts)

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/auth/user` | `users:read` or `users:manage` | Now paginated: `?page, limit (≤100), search, role` → `{message, users, meta}` |
| PATCH | `/auth/user/:id/access` | `users:manage` | `{branches?: [ids], isActive?}`. You can only add/remove branches you can access. A deactivated account is refused on its next request |
| GET | `/auth/me` | user | Also `branchScope` and `memberId` |

### AI assistant

`POST /assistant/ask` works without any AI provider (keyword search). With
`ANTHROPIC_API_KEY` set, Claude (`ASSISTANT_MODEL`, default `claude-opus-5-5`) turns the
question into search filters (structured output), the API runs the normal public catalogue
search, and Claude writes a short answer from those records only. The API then drops any
recommended id that was not in the results. The assistant never sees member data,
loans, unpublished or staff-only material. Failures and refusals fall back to keyword
search.
