FROM node:22-alpine AS base
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm install

COPY shared-types ./shared-types
RUN cd shared-types && npm install && npm run build && \
    node -e "const pkg=require('./package.json'); pkg.main='dist/index.js'; pkg.types='dist/index.d.ts'; pkg.exports={'.':{'import':'./dist/index.js','require':'./dist/index.js','types':'./dist/index.d.ts'}}; pkg.files=['dist/**/*']; require('fs').writeFileSync('./package.json',JSON.stringify(pkg,null,2));" && \
    npm pack && cd .. && npm install ./shared-types/*.tgz

FROM base AS dev
COPY dashboard/ ./
EXPOSE 4200

FROM base AS build
COPY dashboard/ ./
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist/dashboard /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
