# ---------- Base Stage ----------
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

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
