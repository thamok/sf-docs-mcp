# Salesforce Docs MCP Server (v1)

Production-oriented, **read-only** MCP server for semantic-ish/hybrid search and fetch over official Salesforce docs.

- Streamable HTTP endpoint at `/mcp`
- MCP tools: `search`, `fetch`, `getRelated`, `stats`
- Bearer auth for hosted mode
- CORS allowlist for browser-connected MCP clients
- Dockerized deployment path for Raspberry Pi or cloud VM/container
- LibreChat-ready remote MCP configuration

## Important hosting note

A dynamic MCP server **cannot run on GitHub Pages** (Pages serves static files only). Use a Raspberry Pi, VM, container platform, or serverless runtime for `/mcp`.

## Quick start

```bash
npm install
npm run -w @sf-docs/server build
AUTH_TOKEN=change-me npm run -w @sf-docs/server start
```

Server defaults:
- `http://0.0.0.0:3000/mcp`
- health check: `http://0.0.0.0:3000/health`

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | HTTP port |
| `AUTH_TOKEN` | unset | Bearer token for all requests when set |
| `INDEX_PATH` | `data/seed-index.json` | Path to local indexed corpus JSON |
| `CORS_ALLOWLIST` | unset | Comma-separated origin allowlist |
| `LOG_LEVEL` | `info` | pino log level |

## MCP tools

### `search`
Input:
```json
{
  "query": "How do I authenticate with the Tooling API?",
  "top_k": 8,
  "product_family": "api",
  "url_prefix": "https://developer.salesforce.com/docs",
  "include_snippets": true
}
```

### `fetch`
Input:
```json
{ "id": "chunk-tooling-auth-session" }
```

### `getRelated`
Input:
```json
{ "id": "chunk-tooling-auth-session", "top_k": 5 }
```

### `stats`
Input:
```json
{}
```

## Docker deployment

```bash
docker build -t sf-docs-mcp:1.0.0 .
docker run --rm -p 3000:3000 \
  -e AUTH_TOKEN=change-me \
  sf-docs-mcp:1.0.0
```

Or use compose:
```bash
docker compose up --build -d
```

## Raspberry Pi deployment

1. Install Docker Engine on Raspberry Pi OS.
2. Clone this repo and build image locally.
3. Run with restart policy, mounted index file, and TLS via reverse proxy (Caddy/Nginx).
4. Optionally install the provided systemd unit from `deploy/sf-docs-mcp.service`.

## LibreChat MCP integration

Use `deploy/librechat-mcp-example.json` as a template.

Minimal shape:

```json
{
  "name": "salesforce-docs",
  "type": "streamable_http",
  "url": "https://your-host.example.com/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN"
  }
}
```

## Codex remote MCP config

See `.codex/config.toml.sample`.

## Sample AGENTS instruction file

See `AGENTS.sample.md`.
