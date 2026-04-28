# =============================================================================
# Web App Dockerfile
# Implements: EP §18, DR-041 (tag-only references, no SHA digests)
# =============================================================================

# Stage 1: Install dependencies
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: Build static files
FROM deps AS build

COPY . .
RUN pnpm --filter @za/web run build

# Stage 3: Serve with nginx
FROM nginx:alpine AS production

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
