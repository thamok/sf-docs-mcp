FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json apps/server/
RUN npm install
COPY . .
RUN npm run -w @sf-docs/server build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/data ./apps/server/data
EXPOSE 3000
CMD ["node", "apps/server/dist/apps/server/src/index.js"]
