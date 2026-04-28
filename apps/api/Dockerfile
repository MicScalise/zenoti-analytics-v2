# =============================================================================
# API Server Dockerfile
# Implements: EP §18, DR-041 (tag-only references, no SHA digests)
# =============================================================================

# Stage 1: Install dependencies
FROM node:22-alpine AS deps

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./

# Copy all package.json files for workspace resolution
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/utils/package.json ./packages/utils/

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build

COPY . .
RUN pnpm --filter @za/api run build

# Stage 3: Production image
FROM node:22-alpine AS production

WORKDIR /app

# Copy built files and dependencies
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
