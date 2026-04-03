# Container startup

## Build

```bash
docker build -t sf-docs-mcp:local .
```

## Run (local mode)

```bash
docker run --rm -p 8000:8000 sf-docs-mcp:local
```

## Run (hosted mode with auth + CORS)

```bash
docker run --rm -p 8000:8000 \
  -e HOSTED_MODE=true \
  -e BEARER_TOKEN=super-secret-token \
  -e CORS_ALLOWLIST=https://my-ui.example.com,https://admin.example.com \
  sf-docs-mcp:local
```

## Endpoints

- `GET /health`
- `GET /metrics`
- `POST /search`
- `POST /crawl`
