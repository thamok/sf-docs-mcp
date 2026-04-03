FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
RUN npm install

FROM deps AS build
COPY apps/server ./apps/server
RUN npm run -w @sf-docs-mcp/server build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY apps/server/package.json ./apps/server/package.json
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
