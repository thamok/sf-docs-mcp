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

## Quick start

```bash
python -m pip install -e .[dev]
uvicorn packages.api.app.main:app --reload
```
