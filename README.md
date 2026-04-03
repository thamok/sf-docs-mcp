# sf-docs-mcp

Semantic search for Salesforce documentation with hosted-mode auth, strict origin validation,
incremental sync scheduling, and evaluation harness support.

## Quick start

```bash
npm install
npm run -w @sf-docs-mcp/server typecheck
npm run -w @sf-docs-mcp/evals run
```

## What is included

- Bearer-token middleware and strict CORS/origin validation in `apps/server/src/auth`.
- Structured JSON logging and in-memory metrics around query/crawl/extraction/search latency.
- Incremental sync scheduler with hourly polling + nightly refresh and conditional metadata checks.
- `packages/evals` with 50+ relevance queries and reporting for Recall@5, MRR@10, nDCG@10.
- Dockerfiles for server/evals and sample Fly deployment manifest.
- `.codex/config.toml` remote MCP sample and repository `AGENTS.md` guidance.

See `docs-env.md` for environment variable details.
