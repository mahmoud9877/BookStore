# Bookstore (BookSaw)

An online bookstore: customers browse books, manage a cart and place cash or card
(Stripe) orders; admins manage the catalogue.

| App | Path | Stack |
| --- | --- | --- |
| API | [`apps/api`](apps/api) | Node.js 20, Express 4, MongoDB (Mongoose 6), JWT, Joi, Cloudinary, Stripe, Nodemailer |
| Web | [`apps/web`](apps/web) | React 18 (Create React App), React Router 6 (hash routing), Bootstrap 5, Axios |

Further reading: [architecture & conventions](docs/architecture.md) ·
[API reference](docs/api.md) · [Postman collection](docs/bookstore-api.postman_collection.json) (outdated paths — see the API reference).

## Repository layout

```text
.
├── apps/
│   ├── api/                  Express REST API
│   │   ├── src/
│   │   │   ├── config/       env.js — loads and validates environment variables
│   │   │   ├── core/         HttpError hierarchy, BaseRepository, RequestDto/ResponseDto
│   │   │   ├── infrastructure/  Database, StripePaymentGateway, CloudinaryImageStorage, GmailMailer
│   │   │   ├── middleware/   AuthGuard, validate, upload, error-handler
│   │   │   ├── security/     PasswordHasher, JwtTokenService
│   │   │   ├── modules/      auth, books, categories, cart, orders, users —
│   │   │   │                 each: routes → controller → service → repository → model,
│   │   │   │                 with request/response DTOs in <entity>.dto.js
│   │   │   ├── container.js  composition root: builds and wires every class
│   │   │   ├── app.js        createApp(container): mounts routers, no side effects
│   │   │   └── server.js     env check, DB connection, listen, graceful shutdown
│   │   ├── tests/            node:test suites: services with fakes, HTTP with stubs (no DB)
│   │   └── Dockerfile
│   └── web/                  React single-page app
│       ├── src/
│       │   ├── app/          App.jsx, routes.jsx
│       │   ├── config/       api.js — build-time API settings
│       │   ├── lib/          api-client.js (axios), auth-token.js
│       │   ├── modules/      auth, books, cart, orders, profile (pages + services)
│       │   ├── layouts/      RootLayout, Header, Footer
│       │   ├── components/   ErrorPage, OfflineWarning
│       │   ├── styles/  assets/
│       ├── nginx.conf        production web server + /api reverse proxy
│       └── Dockerfile
├── docs/                     architecture, API reference, Postman collection
├── scripts/smoke-test.sh     end-to-end workflow checks against a running stack
├── docker-compose.yml        shared service definitions
├── docker-compose.dev.yml    development overrides (local MongoDB, hot reload)
├── docker-compose.prod.yml   production overrides
├── .env.example              every environment variable, placeholders only
└── package.json              convenience scripts (no dependencies)
```

## Quick start (Docker, development)

```bash
cp .env.example .env      # then edit: BEARER_KEY, TOKEN_SIGNATURE, EMAIL_TOKEN at minimum
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

| Service | URL |
| --- | --- |
| Web (CRA dev server, hot reload) | http://localhost:3000 |
| API (nodemon, hot reload) | http://localhost:4000 (health: `/health`) |
| MongoDB | `mongodb://localhost:27017/bookstore` |

Development always uses the local `mongo` container (data in the `bookstore_mongo-data`
volume) regardless of `MONGODB_URI`, and email confirmation is off by default so new
accounts can log in immediately. Host ports are bound to `127.0.0.1` and configurable
with `DEV_WEB_PORT`, `DEV_API_PORT`, `DEV_MONGO_PORT`.

To create an admin (needed for the `/dashboard` page), sign up and then:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec mongo \
  mongosh bookstore --eval 'db.users.updateOne({email: "you@example.com"}, {$set: {role: "Admin"}})'
```

Books can only be added once Cloudinary is configured (cover images are required).
The catalogue's category must exist in the `categories` collection (`POST /category` as an admin).

## Production (Docker)

```bash
cp .env.example .env      # real secrets; MONGODB_URI must point to your database
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- Only the web container is published (`WEB_PORT`, default **8080**). nginx serves the
  static build and proxies `/api/*` to the API, which is not reachable from the host.
- MongoDB is **not** part of the production stack; set `MONGODB_URI` to an external database
  (e.g. MongoDB Atlas, as used by the existing Vercel deployment).
- The API refuses to start if a required variable is missing or still a `change-me…`
  placeholder. Both containers run as non-root users with read-only filesystems.
- `REACT_APP_*` values are baked into the web bundle at build time: rebuild the `web`
  image after changing `BEARER_KEY` or `PUBLIC_API_URL`.
- Stripe webhook URL: `https://<your-domain>/api/order/webhook`. TLS termination is
  expected in front of port 8080 (load balancer or reverse proxy).

## Everyday commands

```bash
# Logs and status (add the same -f flags you started with)
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

# Stop (add -v to also delete the development database volume)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Shortcuts from the root package.json
npm run dev      # development stack (foreground)
npm run prod     # production stack (detached)
npm run down     # stop either stack
```

## Running without Docker

```bash
npm run install:all
# API: reads apps/api/.env (or legacy apps/api/config/.env); needs a reachable MongoDB
cp .env.example apps/api/.env && npm --prefix apps/api run dev
# Web: talks to REACT_APP_API_URL (defaults to the deployed Vercel API)
REACT_APP_API_URL=http://localhost:3000 PORT=3001 npm --prefix apps/web start
```

## Tests, lint and builds

```bash
npm test                         # API (node:test, 96 tests) + web (Jest/RTL, 25 tests)
npm run lint                     # ESLint for the web app (zero warnings allowed)
CI=true npm --prefix apps/web run build

# End-to-end workflows against the running development stack (real MongoDB):
./scripts/smoke-test.sh
```

## Environment variables

All variables are documented in [`.env.example`](.env.example). Required by the API:
`MONGODB_URI`, `BEARER_KEY`, `TOKEN_SIGNATURE`, `EMAIL_TOKEN`, `SALT_ROUND`.
Optional: `FRONTEND_URL`, `APP_NAME`, `REQUIRE_EMAIL_CONFIRMATION`, `CLOUDINARY_*`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EMAIL`, `EMAIL_PASSWORD`.

Several variables were renamed; the old names still work and log a deprecation warning
(see [compatibility notes](docs/architecture.md#environment-variable-renames)).

## Authentication

`POST /auth/login` returns a JWT. Authenticated requests send
`Authorization: <BEARER_KEY><token>` (the prefix, not `Bearer `, is what the API expects).
Roles: `User` (default) and `Admin`. See [docs/api.md](docs/api.md) for per-endpoint access.

## Existing deployments

This repository merges the former `mahmoud9877/book_Store` (API) and
`mahmoud9877/bookStore_` (web) repositories with their full history. It has no Git
remote yet. Before pushing, repoint the existing deployments:

- **Vercel (API):** set the project's *Root Directory* to `apps/api`; `vercel.json` now
  points at `src/server.js`. Rename env vars at leisure — legacy names keep working.
- **GitHub Pages (web):** run `npm run deploy` from `apps/web` (unchanged). The build still
  defaults to the Vercel API URL and existing bearer prefix when `REACT_APP_*` are unset.
