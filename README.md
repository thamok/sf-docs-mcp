# sf-docs-mcp

Semantic search for Salesforce documentation.

## Features

- Bearer token auth middleware for hosted mode (`HOSTED_MODE=true`).
- CORS allowlist and explicit origin validation (`CORS_ALLOWLIST`).
- Structured JSON logs and in-memory metrics:
  - query latency
  - embedding latency
  - vector latency
  - crawl success/failure
- Eval harness in `packages/evals` with 50-query set and metrics:
  - Recall@5
  - MRR@10
  - nDCG@10
- CI workflow for extraction/index/search tests + eval run.
Semantic search for Salesforce documentation with hosted-mode auth, strict origin validation,
incremental sync scheduling, and evaluation harness support.

## Quick start

```bash
python -m pip install -e .[dev]
uvicorn packages.api.app.main:app --reload
```
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
