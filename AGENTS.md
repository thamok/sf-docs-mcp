# Project AGENTS guidance (sample)

## Working agreement
- Prefer small, reviewable pull requests.
- Run `pytest -q` and `python -m packages.evals.run_eval` before committing.
- Keep logs structured as JSON for observability tooling.

## Retrieval changes
- If search ranking logic changes, update `packages/evals/data/query_set.jsonl` and call out expected metric impact.
- Do not reduce eval query count below 50 without explicit approval.

## Deployment changes
- Keep Docker and deployment manifests in sync.
- Document any new required env vars in `docs/container-startup.md`.
# AGENTS

## Purpose
This repo powers semantic search over Salesforce docs via an MCP-compatible server.

## Usage guidance
- Run `npm install` once at repo root before local development.
- Use `npm run -w @sf-docs-mcp/server typecheck` after backend changes.
- Use `npm run -w @sf-docs-mcp/evals run` when relevance logic changes.
- Keep auth middleware under `apps/server/src/auth`.
- Keep evaluation datasets under `packages/evals/data`.

## Hosted mode checklist
- Set `HOSTED_MODE=true` and a strong `BEARER_TOKEN`.
- Lock down `ALLOWED_ORIGINS` to exact origins (comma-separated).
- Configure `SITEMAP_URL` for incremental sync.
