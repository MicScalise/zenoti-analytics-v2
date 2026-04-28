# =============================================================================
# Workers Dockerfile
# Implements: EP §18, DR-041 (tag-only references, no SHA digests)
# =============================================================================

# Stage 1: Install dependencies
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/utils/package.json ./packages/utils/

RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build

COPY . .
RUN pnpm --filter @za/workers run build

# Stage 3: Production image
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=build /app/apps/workers/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/workers/package.json ./

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
