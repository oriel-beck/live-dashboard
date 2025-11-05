# Pull base images from registry
ARG REGISTRY_HOST=localhost:5000
FROM ${REGISTRY_HOST}/shared-base:latest AS shared-source
FROM ${REGISTRY_HOST}/services-base:latest AS services-source

FROM oven/bun:1.2-alpine AS base
WORKDIR /workspace

RUN apk add --no-cache nodejs

# Copy built shared and services from registry images (no node_modules, just artifacts)
# Place them as siblings so workspace dependencies resolve correctly
COPY --from=shared-source /shared ./shared
COPY --from=services-source /services ./services

# Install dependencies for shared (needed at runtime)
# Then install dependencies for services (needed at runtime)
RUN cd /workspace/shared && rm -f bun.lock && bun install && \
    cd /workspace/services && rm -f bun.lock && bun install

# Copy bot package.json and install dependencies
COPY bot/package*.json ./bot/
RUN cd /workspace/bot && bun install

FROM base AS dev
WORKDIR /workspace/bot
COPY bot/ ./ 

FROM base AS prod
WORKDIR /workspace/bot
COPY bot/ ./
ENV NODE_ENV=production
CMD ["bun", "run", "start"]

