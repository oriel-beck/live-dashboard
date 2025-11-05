# Pull base image from registry
ARG REGISTRY_HOST=localhost:5000
FROM ${REGISTRY_HOST}/shared-base:latest AS shared-source

FROM node:22-alpine AS base
WORKDIR /workspace

# Copy built shared from registry image (no node_modules, just artifacts)
# Place it as sibling so workspace dependencies resolve correctly
COPY --from=shared-source /shared ./shared

# Install dependencies for shared (needed for TypeScript compilation)
RUN cd ./shared && rm -f package-lock.json bun.lock && npm install

# Copy dashboard package.json and install dependencies
COPY dashboard/package*.json ./dashboard/
RUN cd ./dashboard && npm install

FROM base AS dev
WORKDIR /workspace/dashboard
COPY dashboard/ ./
EXPOSE 4200

FROM base AS build
WORKDIR /workspace/dashboard
COPY dashboard/ ./
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY --from=build /workspace/dashboard/dist/dashboard /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
