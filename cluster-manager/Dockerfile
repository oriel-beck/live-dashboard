FROM oven/bun:1.2-alpine AS base
WORKDIR /app

COPY shared-types ../shared-types
RUN cd ../shared-types && rm -f bun.lock && bun install

COPY cluster-manager/package*.json ./

RUN rm -rf node_modules && bun install

FROM base AS dev
COPY cluster-manager/ ./ 
COPY --from=base /app/../shared-types ../shared-types
RUN rm -rf ../shared-types/dist
CMD ["bun", "run", "dev"]

FROM base AS prod
COPY cluster-manager/ ./
COPY --from=base /app/../shared-types ../shared-types
RUN cd ../shared-types && bun run build
CMD ["bun", "run", "start"]

