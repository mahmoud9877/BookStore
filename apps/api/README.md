# Bookstore API

Express 5 + MongoDB REST API. See the [root README](../../README.md) for setup and Docker,
[docs/api.md](../../docs/api.md) for endpoints and
[docs/architecture.md](../../docs/architecture.md) for structure and conventions.

```bash
npm ci
npm run dev     # nodemon; reads .env (or legacy config/.env)
npm test        # node:test, no database required
npm start       # production
```

Login returns a 15-minute access token and sets a rotating, seven-day refresh token
in an HttpOnly cookie. Configure `FRONTEND_URL` (and `CORS_ORIGINS` for additional
origins) when the web app and API use different origins.
