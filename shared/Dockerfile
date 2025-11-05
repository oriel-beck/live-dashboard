# Build stage - install dependencies and build
FROM node:22-alpine AS builder
WORKDIR /build
COPY . .
RUN rm -f bun.lock && npm install && npm run build

# Minimal runtime base - only copy built artifacts (no node_modules)
# Place at root level so workspace dependencies resolve correctly (../shared)
FROM alpine:latest AS shared-base
# Copy all necessary files: src (for TypeScript), dist (compiled), and package.json
COPY --from=builder /build/src /shared/src
COPY --from=builder /build/dist /shared/dist
# Copy original package.json
COPY --from=builder /build/package.json /shared/package.json
COPY --from=builder /build/tsconfig.json /shared/tsconfig.json
# Create a package.json that points to dist for bundlers (Angular esbuild)
# This will be used by Angular's esbuild which needs compiled JS files
RUN echo '{"name":"@discord-bot/shared","version":"1.0.0","main":"./dist/index.js","types":"./dist/index.d.ts","exports":{".":{"import":"./dist/index.js","require":"./dist/index.js","types":"./dist/index.d.ts"}}}' > /shared/dist-package.json

