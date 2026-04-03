FROM node:22-alpine
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages/evals/package.json packages/evals/package.json
RUN npm install
COPY packages/evals ./packages/evals
RUN npm run -w @sf-docs-mcp/evals build
CMD ["npm", "run", "-w", "@sf-docs-mcp/evals", "run"]
