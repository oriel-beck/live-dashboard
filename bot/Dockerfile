FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install Node.js for compatibility with discord-hybrid-sharding
RUN apk add --no-cache nodejs npm

# Copy shared-types to parent directory and build it
COPY shared-types ../shared-types
RUN cd ../shared-types && rm -f bun.lock && bun install && bun run build

# Copy bot files
COPY bot/package*.json ./

# Install all dependencies (including shared-types as local file)
RUN bun install

# Development stage with live reloading (clustering by default)
FROM base AS dev
# Copy bot files
COPY bot/ ./
# Use bun run dev:cluster (Docker Compose watch handles file syncing)
CMD ["bun", "run", "dev"]

# Development stage with clustering
FROM base AS dev-cluster
# Copy bot files
COPY bot/ ./
# Use bun run dev:cluster for clustering development
CMD ["bun", "run", "dev:cluster"]

# Build stage for clustering
FROM base AS build
# Copy bot files
COPY bot/ ./
# Build TypeScript to JavaScript for clustering
RUN bun run build

# Production stage
FROM oven/bun:1.2-alpine AS prod
WORKDIR /app

# Install Node.js for clustering
RUN apk add --no-cache nodejs

COPY --from=base /app/package*.json ./
COPY --from=base /app/node_modules ./node_modules
COPY bot/ ./
RUN bun install --production

CMD ["bun", "run", "start"]

# Production stage with clustering
FROM oven/bun:1.2-alpine AS prod-cluster
WORKDIR /app

# Install Node.js for clustering
RUN apk add --no-cache nodejs

COPY --from=base /app/package*.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src

# Use cluster manager for production
CMD ["bun", "run", "start:cluster"]
