FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Copy shared-types to parent directory and build it
COPY shared-types ../shared-types
RUN cd ../shared-types && rm -f bun.lock && bun install && bun run build

# Copy bot files
COPY bot/package*.json ./

# Install all dependencies (including shared-types as local file)
RUN bun install

# Development stage with live reloading
FROM base AS dev
# Copy bot files
COPY bot/ ./
# Use bun run dev (Docker Compose watch handles file syncing)
CMD ["bun", "run", "dev"]

# Production stage
FROM oven/bun:1.2-alpine AS prod
WORKDIR /app
COPY --from=base /app/package*.json ./
COPY --from=base /app/node_modules ./node_modules
COPY bot/ ./
RUN bun install --production

CMD ["bun", "run", "start"]
