# API reference

Base URL: `http://localhost:4000` (Docker development), `/api` behind the production
nginx proxy, or the Vercel deployment.

Authenticated requests send `Authorization: <BEARER_KEY><jwt>` (the configured prefix
directly followed by the token from `POST /auth/login`).

Access levels: **public**, **user** (any signed-in account), **admin** (`role: "Admin"`).

Unknown request fields are ignored; responses contain only documented fields (see the
response DTOs in `apps/api/src/modules/*/<entity>.dto.js`).

Errors are JSON: `{ "message": "..." }`. Validation failures return
`400 { "message": "validationErr", "validationErr": [ ...Joi details ] }`.
In production, 5xx responses only say `"Internal server error"`; stack traces are
included only when `NODE_ENV=development`.

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
| GET | `/auth/user` | admin | `{message:"done", users}` (password and code excluded) |

When `REQUIRE_EMAIL_CONFIRMATION=false`, new accounts are created already confirmed.

## Books — `/book`

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/book` | public | `{book: [...]}` newest first. Optional `?limit=&page=` pagination |
| GET | `/book/:bookId` | public | `{message:"Done", book}` |
| POST | `/book/add` | admin | `multipart/form-data`: `bookTitle, author, description, price, category, quantity, image` (jpeg/png/gif). Category must exist by name |
| POST | `/book/edit/:id` | admin | Same fields; `image` optional. Returns the updated book |
| DELETE | `/book/delete/:id` | admin | |
| PATCH | `/book/:bookId/like` | user | `400` if already liked |
| PATCH | `/book/:bookId/unlike` | user | `400` if not liked |

`quantity` is the number of copies in stock.

## Categories — `/category`

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/category` | public | Array of categories |
| GET | `/category/options` | public | `{categories: ["fiction", "non-fiction", "science", "biography", "fantasy"]}` |
| GET | `/category/:id` | public | |
| POST | `/category` | admin | `{name}` |
| PUT | `/category/:id` | admin | `{name}` — must be one of the options |
| DELETE | `/category/:id` | admin | |

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
| PATCH | `/order/:orderId/delivered` | admin | Allowed from `placed` / `onWay` |
| POST | `/order/webhook` | Stripe | Signature-verified raw body. `checkout.session.completed` → `placed`; `checkout.session.expired` / `async_payment_failed` → `rejected` and stock released |

Order statuses: `waitPayment`, `placed`, `onWay`, `delivered`, `canceled`, `rejected`.
