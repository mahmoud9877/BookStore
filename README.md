# Library (BookSaw)

A library management system for a multi-branch library, grown from the original
BookSaw bookstore (whose shop — cart and cash/card orders — still works). It covers the
catalogue (editions, authors, publishers, physical copies with barcodes), circulation
(loans, returns, renewals, reservation queues, transfers between branches), members and
membership types, fines and payments, inventory (stocktakes, adjustments) and
acquisitions, rooms and events, a digital library, notifications, reports and an audit
log — with role-based, branch-scoped permissions and a member self-service portal.

| App | Path | Stack |
| --- | --- | --- |
| API | [`apps/api`](apps/api) | Node.js 20, Express 4, MongoDB 7 replica set (Mongoose 6, transactions), Joi, JWT, Stripe, Nodemailer, optional Cloudinary and Claude (`@anthropic-ai/sdk`) |
| Worker | [`apps/api/src/worker.js`](apps/api/src/worker.js) | Same code base: email delivery and scheduled jobs |
| Web | [`apps/web`](apps/web) | React 18 (Create React App), React Router 6 (hash routing), TanStack Query, Zustand, Bootstrap 5, Axios |

Further reading: [architecture, data model & decisions](docs/architecture.md) ·
[API reference](docs/api.md).

## Modules

| Area | What it does |
| --- | --- |
| Catalogue | Books are editions (ISBN validated and unique, editions of a title grouped); authors, publishers, categories, subjects, keywords; covers (Cloudinary or local storage); full-text search with availability, filters, sorting, pagination; related titles from catalogue data only |
| Copies | Physical items with generated or scanned barcodes, branch, shelf, condition, cost; status changes only through workflows or audited adjustments |
| Circulation | Desk checkout/return by barcode, renewals, lost/damaged; limits and loan periods per membership type; staff overrides with a reason; reservation queues with holds, pickup expiry and cross-branch pickup |
| Members | Individuals, students, researchers, institutions; registration, renewal, suspension, cancellation, history; optional link to a sign-in account for self-service |
| Finance | Overdue/lost/damaged/manual fines from configurable policy, cash payments with receipts and idempotency, card payments via Stripe Checkout with verified webhooks, refunds, waivers |
| Inventory | Counts by branch and status, manual adjustments with reasons, stocktakes with reconciliation, transfers between branches with history |
| Acquisitions | Suppliers, purchase requests → approval → purchase orders → deliveries that add costed copies, purchase documents |
| Branches | Branches, rooms and shelves; staff assigned to branches |
| Rooms & events | Bookable rooms with conflict prevention and booking policy; events with capacity-limited registration |
| Digital library | Uploaded publications in private storage, access by membership and licence, every open logged |
| Notifications | In-app inbox and email (due soon, overdue, reservation ready/expired, membership expiring, fines, payments), configurable templates, retries, no duplicates |
| Reports | Most/least borrowed, inventory, overdue, fines and collections, memberships, reservations, acquisitions, branch comparison, staff activity; date ranges, pagination, CSV |
| Administration | Roles with granular permissions and branch scope, users, settings (policies), audit log |
| Assistant | Optional natural-language catalogue search (Claude), grounded in catalogue records; keyword search without a key |

## Repository layout

```text
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/          env.js — loads and validates environment variables
│   │   │   ├── core/            HttpError, BaseRepository, DTOs, pagination, AccessContext,
│   │   │   │                    transaction context, CrudService/Controller/routes
│   │   │   ├── infrastructure/  Database, TransactionRunner, SequenceGenerator, JobScheduler,
│   │   │   │                    LocalFileStorage, Cloudinary, Stripe, Gmail/Log mailers
│   │   │   ├── middleware/      AuthGuard (permissions + branch scope), validate, upload, rate limit, errors
│   │   │   ├── modules/         one folder per module: routes → controller → service →
│   │   │   │                    repository → model, DTOs in <entity>.dto.js
│   │   │   ├── migrations/      ordered, idempotent data/index migrations + runner
│   │   │   ├── container.js     composition root
│   │   │   ├── app.js           createApp(container)
│   │   │   ├── server.js        HTTP server
│   │   │   ├── worker.js        background worker
│   │   │   ├── migrate.js       `npm run migrate` / `migrate:status`
│   │   │   └── seed-demo.js     demo library data (development only)
│   │   ├── tests/               unit + HTTP tests (no database)
│   │   │   └── integration/     real MongoDB replica set: transactions, concurrency, workflows
│   │   └── Dockerfile
│   └── web/
│       └── src/
│           ├── app/             App.jsx, routes.jsx
│           ├── lib/             api-client, resource hooks (paged queries, mutations), formatting
│           ├── components/ui/   DataTable, Pagination, PageHeader, StatusBadge, Modal, forms, toasts…
│           ├── modules/         admin (dashboard shell), circulation, members, finance, books,
│           │                    copies, authors, digital, transfers, inventory, acquisitions,
│           │                    branches, facilities, reports, audit, settings, users, roles,
│           │                    account (member portal), assistant, auth, cart, orders, profile
│           └── layouts/, hooks/, styles/
├── docs/                        architecture.md, api.md
├── scripts/                     seed-dev-data.sh, smoke-test.sh
├── docker-compose.yml           shared services: api, worker, web
├── docker-compose.dev.yml       development: MongoDB replica set, hot reload, log mailer
├── docker-compose.prod.yml      production: built images, migrate job, optional MongoDB
└── .env.example                 every environment variable (placeholders only)
```

## Run it locally (Docker, development)

```bash
cp .env.example .env                 # set BEARER_KEY, TOKEN_SIGNATURE, EMAIL_TOKEN at minimum
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
./scripts/seed-dev-data.sh           # optional: demo catalogue, accounts and library data
```

| Service | URL / notes |
| --- | --- |
| Web (hot reload) | http://localhost:3000 — product page `/#/`, catalogue `/#/catalog`, member portal `/#/account`, staff workspace `/#/dashboard` |
| API (hot reload) | http://localhost:4000 — health at `/health` |
| Worker | logs only (`… logs -f worker`); emails are printed, never sent (`MAIL_TRANSPORT=log`) |
| MongoDB | single-node replica set `rs0`, `127.0.0.1:27017` (data in the `mongo-data` volume) |

The API container applies pending migrations before starting. Demo accounts after
seeding: `admin@bookstore.local` / `admin123` (Admin, both branches) and
`reader@bookstore.local` / `reader123` (a library member with loans). `npm run dev` from the
repository root starts the same stack in the foreground; `npm run down` stops it.

To make your own account an administrator, sign up, then:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec mongo \
  mongosh bookstore --eval 'db.users.updateOne({email: "you@example.com"}, {$set: {role: "Admin"}})'
```

After that, assign roles and branches in **Dashboard → Users**.

## Production (Docker)

```bash
cp .env.example .env     # real secrets; MONGODB_URI must be a replica set (e.g. MongoDB Atlas)
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate   # every deployment
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

- **Published port:** only `web` (`WEB_PORT`, default 8080). nginx serves the static build and
  proxies `/api/*` to the API; the API, worker and database are not reachable from the host.
- **HTTPS:** terminate TLS in front of port 8080 (load balancer or a reverse proxy such as
  Caddy/Traefik/nginx). Set `FRONTEND_URL` to the public URL (Stripe return links, emails).
- **Database:** use a managed replica set via `MONGODB_URI`, or the bundled one:
  `--profile local-db` and `MONGODB_URI=mongodb://mongo:27017/library?replicaSet=rs0`
  (data in the `mongo-data` volume, file limit raised to 64000 as MongoDB requires).
- **Migrations** never run implicitly: run the `migrate` service on each deployment (the API
  logs a warning when some are pending). They only add data and indexes.
- **Worker:** the `worker` service must run for emails, hold expiry and reminders. Several
  copies are safe (job leases).
- **Files:** covers without Cloudinary, digital publications and purchase documents live in
  the `uploads` volume — back it up with the database.
- **Hardening:** API, worker and web run as non-root with read-only filesystems and
  `no-new-privileges`; the API refuses to start with missing or placeholder secrets; login and
  the assistant are rate limited per IP (also limit at your proxy when running several
  API instances); set `CORS_ORIGINS` to your site.
- **Stripe:** webhook URL `https://<your-domain>/api/payments/webhook` (events
  `checkout.session.completed`, `.expired`, `.async_payment_failed`).
- `ENV_FILE=<file>` (and `--env-file <file>`) selects another environment file than `.env`,
  e.g. to run a staging copy next to production with `COMPOSE_PROJECT_NAME`.
- `REACT_APP_*` values are baked into the web build: rebuild `web` after changing `BEARER_KEY`
  or `PUBLIC_API_URL`.

### Backups and restore

```bash
# MongoDB (bundled database; for Atlas use its backups or mongodump with your URI)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mongo \
  mongodump --archive --gzip --db library > library-$(date +%F).archive.gz
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mongo \
  mongorestore --archive --gzip --drop < library-YYYY-MM-DD.archive.gz

# Uploaded files
docker run --rm -v bookstore_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Schedule both (e.g. nightly cron on the host) and test a restore regularly.

## Everyday commands

```bash
C="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
$C logs -f api worker            # logs
$C exec api npm run migrate:status
$C exec api npm run migrate
$C exec api npm run seed:demo    # demo library data (development only, idempotent)
$C down                          # stop (add -v to delete the development volumes)
```

## Running without Docker

You need a MongoDB **replica set** (transactions); a standalone server will not work.

```bash
npm run install:all
cp .env.example apps/api/.env    # MONGODB_URI=mongodb://localhost:27017/library?replicaSet=rs0
npm --prefix apps/api run migrate
npm --prefix apps/api run dev            # API on :3000
npm --prefix apps/api run worker:dev     # worker
REACT_APP_API_URL=http://localhost:3000 PORT=3001 npm --prefix apps/web start
```

## Tests and checks

```bash
npm --prefix apps/api test            # unit + HTTP tests, no database
npm --prefix apps/web run lint        # ESLint, zero warnings allowed
CI=true npm --prefix apps/web test -- --watchAll=false
CI=true npm --prefix apps/web run build

# Against the running development stack (real MongoDB replica set):
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api npm run test:integration
./scripts/smoke-test.sh               # end-to-end HTTP workflows (shop + library)
docker compose -f docker-compose.yml -f docker-compose.prod.yml config -q   # compose validation
```

The integration tests drop and recreate a `library_test` database (they refuse any
database whose name does not end in `_test`).

## Environment variables

All variables are documented in [`.env.example`](.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | Replica-set connection string |
| `BEARER_KEY`, `TOKEN_SIGNATURE`, `EMAIL_TOKEN`, `SALT_ROUND` | yes | Auth header prefix, JWT secrets, bcrypt cost |
| `FRONTEND_URL` | recommended | Public web URL (payment return links, email confirmation) |
| `CORS_ORIGINS` | recommended | Allowed browser origins (default: any) |
| `MAIL_TRANSPORT`, `EMAIL`, `EMAIL_PASSWORD`, `MAIL_FROM_NAME` | for email | `gmail` or `log` (default `log` outside production) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | for card payments | Without them, members pay at a desk |
| `CLOUDINARY_*` | optional | Cover images on Cloudinary instead of the uploads volume |
| `UPLOAD_DIR` | optional | File storage root (Docker: `/app/uploads`) |
| `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL` | optional | AI catalogue assistant |
| `WORKER_INTERVAL_MS`, `REQUIRE_EMAIL_CONFIRMATION`, `APP_NAME` | optional | |

## Authentication and permissions

`POST /auth/login` returns a JWT; requests send `Authorization: <BEARER_KEY><token>`.
Permissions are checked on the server for every request and come from the account's
role (looked up per request, so changes and deactivations apply immediately). Roles
have a branch scope (`all` or the account's assigned branches). Built in: **Admin**
(everything, all branches) and **User** (members/shoppers). Migrations create editable
starting roles: Librarian, Branch Manager, Inventory Staff, Finance Staff. See
[docs/api.md](docs/api.md) for per-endpoint access.

## Known limitations and integrations not included

- **Policies are the library's decision.** Defaults charge no fines; the `STANDARD`
  membership type's limits are placeholders. Review **Dashboard → Settings** first.
- **Vercel deployment** (`apps/api/vercel.json`) runs the API only: no worker (so no
  emails, reminders or hold expiry), and uploads need persistent storage. Use the Docker
  production stack for the full system, or run the worker elsewhere against the same database.
- **File storage** is the local/volume backend (plus Cloudinary for covers). An S3-compatible
  backend would implement `LocalFileStorage`'s `save/open/remove`; not included.
- **Email** is SMTP via Gmail; other providers need a new mailer with the same `send()`.
  SMS/push are not implemented.
- **Card payments** are Stripe only. Tested with mocked gateway responses and signature
  verification; not exercised against live Stripe from this repository.
- **Not implemented (no fake integrations):** MARC 21 import/export, Z39.50/SRU, SSO /
  institutional identity providers, e-book lending with concurrent-user licence limits,
  dedicated search engine. The code has boundaries for them (search provider port, payment
  gateway port, storage port), documented in [architecture.md](docs/architecture.md).
- **Barcode/QR scanners** work as keyboards (the desk and stocktake fields accept scans);
  no device-specific integration.
- Rate limits are in-memory per API instance; JWTs are long-lived (deactivation still takes
  effect immediately because accounts are checked on every request).

## Existing deployments

This repository merges the former `mahmoud9877/book_Store` (API) and
`mahmoud9877/bookStore_` (web) repositories. Before pushing, repoint the deployments:
Vercel's *Root Directory* → `apps/api`; GitHub Pages → `npm run deploy` from `apps/web`.
Run `npm run migrate` against the production database before deploying this version
(it links existing books to authors and categories and creates indexes, without
removing data).
