# Bookstore API

Express + MongoDB REST API. See the [root README](../../README.md) for setup and Docker,
[docs/api.md](../../docs/api.md) for endpoints and
[docs/architecture.md](../../docs/architecture.md) for structure and conventions.

```bash
npm ci
npm run dev     # nodemon; reads .env (or legacy config/.env)
npm test        # node:test, no database required
npm start       # production
```
