FROM node:22-alpine AS base
WORKDIR /app
COPY bot/package*.json ./
RUN npm install

COPY shared-types ./shared-types
RUN cd shared-types && npm install && npm run build && npm pack && cd .. && npm install ./shared-types/*.tgz

COPY bot/ ./

# Development stage with live reloading
FROM base AS dev
# Use npm run dev (Docker Compose watch handles file syncing)
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm run build

# Production stage
FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm ci --omit=dev && npm cache clean --force

# Add a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S botuser -u 1001
USER botuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot is healthy')" || exit 1

CMD ["npm", "start"]
