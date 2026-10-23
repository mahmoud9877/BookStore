# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- development: CRA dev server with hot reload (src/public bind-mounted)
FROM deps AS development
ENV PUBLIC_URL=/
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# ---- build the static bundle. REACT_APP_* values are baked in at build time.
FROM deps AS build
ARG REACT_APP_API_URL=/api
ARG REACT_APP_BEARER_KEY=
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_BEARER_KEY=$REACT_APP_BEARER_KEY \
    PUBLIC_URL=/ \
    GENERATE_SOURCEMAP=false
COPY . .
RUN npm run build

# ---- production: static files served by unprivileged nginx (listens on 8080)
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
