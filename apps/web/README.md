# Bookstore web app

React 19 single-page app (Create React App). See the [root README](../../README.md) for
setup and Docker and [docs/architecture.md](../../docs/architecture.md) for structure.

```bash
npm ci
REACT_APP_API_URL=http://localhost:4000 npm start   # defaults to the deployed API
npm test
npm run lint
npm run build
npm run deploy                                        # GitHub Pages (gh-pages branch)
```

Build-time settings: `REACT_APP_API_URL`, `REACT_APP_BEARER_KEY` (see `src/config/api.js`).
