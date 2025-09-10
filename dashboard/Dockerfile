FROM node:22-alpine AS base
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm install

COPY shared-types ./shared-types
RUN cd shared-types && npm install && npm run build && npm pack && cd .. && npm install ./shared-types/*.tgz

# Development stage with live reloading
FROM base AS dev
# Copy dashboard files
COPY dashboard/ ./
# Expose port for development
EXPOSE 4200
# No CMD here - docker-compose will override it

# ---------- Build Stage ----------
FROM base AS build
RUN npm run build -- --configuration production

# ---------- Production Stage ----------
FROM nginx:1.27-alpine AS prod
# Copy built Angular dist folder to Nginx html directory
COPY --from=build /app/dist/dashboard /usr/share/nginx/html
# Copy custom nginx config if you have one
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
