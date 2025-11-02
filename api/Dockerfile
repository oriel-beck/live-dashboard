FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Copy shared-types to parent directory
COPY shared-types ../shared-types
# Install shared-types dependencies and build it (needed for module resolution)
RUN cd ../shared-types && rm -f bun.lock && bun install && bun run build

# Copy API files
COPY api/package*.json ./

# Install all dependencies (including shared-types as local file)
# Remove node_modules first to ensure fresh install with updated shared-types package.json
RUN rm -rf node_modules && bun install

# Development stage - no compilation, Bun runs TypeScript directly!
FROM base AS dev
# Copy source code
COPY api/ ./
# Copy shared-types (includes built dist/ for module resolution)
COPY --from=base /app/../shared-types ../shared-types
# Expose port for development
EXPOSE 3000
# Use bun run dev - runs TypeScript directly, no compilation needed!
CMD ["bun", "run", "dev"]

# Production stage - also runs TypeScript directly with Bun, no compilation needed!
FROM base AS prod
WORKDIR /app
# Copy API source files
COPY api/ ./
# Copy shared-types (includes built dist/ for module resolution)
COPY --from=base /app/../shared-types ../shared-types
# Bun runs TypeScript directly, no compilation needed!
CMD ["bun", "run", "start"]
