# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

# ---- development: all dependencies, source bind-mounted by docker-compose.dev.yml
FROM base AS development
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- production dependencies only
FROM base AS production-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---- production: minimal runtime image, non-root
FROM base AS production
ENV NODE_ENV=production
COPY --from=production-deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Mount point for the uploads volume, owned by the unprivileged user.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/server.js"]
