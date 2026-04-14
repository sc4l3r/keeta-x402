# Base for all services
FROM node:22-slim AS base-builder

RUN corepack enable

WORKDIR /app

# Build shared packages
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @x402/core build
RUN pnpm --filter @x402/keeta build

# Build facilitator
FROM base-builder AS facilitator-builder
RUN pnpm --filter facilitator build
RUN pnpm deploy --filter facilitator --prod /prod

# Build server
FROM base-builder AS server-builder
RUN pnpm --filter server build
RUN pnpm deploy --filter server --prod /prod

# Facilitator image
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS facilitator

WORKDIR /app

COPY --from=facilitator-builder /prod/node_modules/ ./node_modules/
COPY --from=facilitator-builder /app/apps/facilitator/dist/ ./dist/

ENV NODE_ENV=production

CMD ["dist/main.js"]

# Server image
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS server

WORKDIR /app

COPY --from=server-builder /prod/node_modules/ ./node_modules/
COPY --from=server-builder /app/apps/server/dist/ ./dist/

ENV NODE_ENV=production

CMD ["dist/main.js"]
