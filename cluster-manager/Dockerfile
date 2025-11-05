# Pull base images from registry
ARG REGISTRY_HOST=localhost:5000
FROM ${REGISTRY_HOST}/shared-base:latest AS shared-source
FROM ${REGISTRY_HOST}/services-base:latest AS services-source

FROM oven/bun:1.2-alpine AS base
WORKDIR /workspace

# Copy built shared and services from registry images (no node_modules, just artifacts)
# Place them as siblings so workspace dependencies resolve correctly
COPY --from=shared-source /shared ./shared
COPY --from=services-source /services ./services

# Install dependencies for shared (needed at runtime)
# Then install dependencies for services (needed at runtime)
RUN cd /workspace/shared && rm -f bun.lock && bun install && \
    cd /workspace/services && rm -f bun.lock && bun install

# Copy cluster-manager package.json and install dependencies
COPY cluster-manager/package*.json ./cluster-manager/
RUN cd /workspace/cluster-manager && bun install

FROM base AS dev
WORKDIR /workspace/cluster-manager
COPY cluster-manager/ ./ 
CMD ["bun", "run", "dev"]

FROM base AS prod
WORKDIR /workspace/cluster-manager
COPY cluster-manager/ ./
CMD ["bun", "run", "start"]

