# Build stage - install dependencies and build
# Pull shared-base from registry (passed as build arg)
ARG REGISTRY_HOST=localhost:5000
FROM ${REGISTRY_HOST}/shared-base:latest AS shared-source

FROM oven/bun:1.2-alpine AS builder
WORKDIR /workspace

# Copy built shared from registry image to workspace/shared (for workspace dependency resolution)
# When services at workspace/services references ../shared, it will resolve correctly
COPY --from=shared-source /shared ./shared

# Copy services source files (build context is ./services) to workspace/services
COPY . ./services

# Install dependencies for shared (needed for TypeScript compilation of services)
# Then install dependencies for services and build
RUN cd ./shared && rm -f bun.lock && bun install && \
    cd ../services && rm -f bun.lock && bun install && bun run build

# Minimal runtime base - only copy built artifacts (no node_modules)
# Place at root level so workspace dependencies resolve correctly (../services)
FROM alpine:latest AS services-base
# Copy services package files (src, dist, package.json, tsconfig.json)
COPY --from=builder /workspace/services/src /services/src
COPY --from=builder /workspace/services/dist /services/dist
COPY --from=builder /workspace/services/package.json /services/package.json
COPY --from=builder /workspace/services/tsconfig.json /services/tsconfig.json

