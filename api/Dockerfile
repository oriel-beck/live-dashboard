FROM node:22-alpine AS base
WORKDIR /app
COPY api/package*.json ./
RUN npm install

COPY shared-types ./shared-types
RUN cd shared-types && npm install && npm run build && npm pack && cd .. && npm install ./shared-types/*.tgz

COPY api/prisma ./prisma
RUN npx prisma generate

# Development stage with live reloading
FROM base AS dev
# Copy source code
COPY api/ ./
# Expose port for development
EXPOSE 3000
# Use npm run dev (Docker Compose watch handles file syncing)
CMD ["npm", "run", "dev"]

# Production stage
FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/package*.json ./
COPY --from=base /app/node_modules ./node_modules
RUN npm ci --omit=dev && npm cache clean --force
CMD ["npm", "start"]
