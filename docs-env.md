# Environment Variables

## Server runtime
- `PORT` (default: `3000`): HTTP port.
- `HOSTED_MODE` (`true`/`false`): enables bearer token auth middleware.
- `BEARER_TOKEN`: required when `HOSTED_MODE=true`.
- `ALLOWED_ORIGINS`: comma-separated allowlist for strict CORS validation.
- `SITEMAP_URL`: sitemap source used by incremental scheduler.

## MCP / Codex
- `MCP_BEARER_TOKEN`: bearer token used by `.codex/config.toml` remote MCP sample.
