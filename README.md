# sf-docs-mcp

Semantic search + document fetch over Salesforce documentation, exposed as an MCP server.

---

## Architecture overview

This project is organized into four functional areas:

- **`server/`**
  - Hosts the MCP server implementation.
  - Exposes tools like `search` and `fetch`.
  - Handles auth, request validation, query orchestration, and response formatting.
- **`crawler/`**
  - Crawls Salesforce docs sources.
  - Normalizes raw pages and extracts clean content/chunks + metadata.
  - Produces crawl artifacts for indexing.
- **`shared/`**
  - Common models, schemas, utilities, and constants reused by both crawler and server.
  - Typical examples: document schema, chunking helpers, embedding adapters, DB/Qdrant helpers.
- **`evals/`**
  - Relevance and quality evaluation harnesses.
  - Regression tests for retrieval quality and result correctness.

Typical data flow:

1. `crawler` ingests and normalizes docs.
2. Indexing writes metadata to Postgres and vectors to Qdrant.
3. `server` receives MCP `search`/`fetch` requests.
4. `server` queries Postgres + Qdrant and returns ranked content.

---

## Prerequisites

- **Runtime:** Python 3.11+ (or your project’s configured version)
- **Package manager:** `pip`/`uv` (examples below use `uv`)
- **Datastores:**
  - PostgreSQL 15+
  - Qdrant (local Docker or managed)
- **API access:** OpenAI API key for embeddings/reranking (if configured)

Optional but recommended:

- Docker + Docker Compose (for local Postgres/Qdrant)

---

## Local startup

### 1) Start local dependencies

```bash
docker compose up -d postgres qdrant
```

### 2) Install dependencies

```bash
uv sync
```

### 3) Set environment variables

```bash
export OPENAI_API_KEY="<your_openai_key>"
export POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/sf_docs"
export QDRANT_URL="http://localhost:6333"
export QDRANT_API_KEY=""                    # optional for local Qdrant
export SF_DOCS_MCP_AUTH_TOKEN="<long_random_token>"
```

### 4) Run the MCP server

```bash
uv run python -m server.main --host 0.0.0.0 --port 8080
```

---

## Required environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `OPENAI_API_KEY` | Yes | OpenAI embeddings/reranking or model calls |
| `POSTGRES_URL` | Yes | Postgres connection string for metadata/state |
| `QDRANT_URL` | Yes | Qdrant endpoint used for vector search |
| `QDRANT_API_KEY` | Depends | Required for secured/managed Qdrant |
| `SF_DOCS_MCP_AUTH_TOKEN` | Yes | Bearer token expected by the MCP server |

---

## Crawl/index bootstrap workflow

Use this sequence to initialize a fresh environment.

### Step 1: Crawl docs

```bash
uv run python -m crawler.crawl \
  --seed https://developer.salesforce.com/docs \
  --output data/crawl/latest
```

### Step 2: Transform/chunk documents

```bash
uv run python -m crawler.transform \
  --input data/crawl/latest \
  --output data/processed/latest
```

### Step 3: Build embeddings + index

```bash
uv run python -m crawler.index \
  --input data/processed/latest \
  --collection sf_docs
```

### Step 4: Validate index

```bash
uv run python -m evals.smoke --collection sf_docs
```

---

## MCP endpoint usage examples

Assuming server is running at `http://localhost:8080/mcp` and protected with bearer auth.

### `search` example

```bash
curl -s http://localhost:8080/mcp \
  -H "Authorization: Bearer $SF_DOCS_MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search",
      "arguments": {
        "query": "How do I create a platform event trigger?",
        "top_k": 5
      }
    }
  }'
```

### `fetch` example

```bash
curl -s http://localhost:8080/mcp \
  -H "Authorization: Bearer $SF_DOCS_MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "fetch",
      "arguments": {
        "doc_id": "<doc_id_from_search_result>"
      }
    }
  }'
```

---

## Sample `.codex/config.toml` (remote MCP)

```toml
[mcp_servers.sf_docs]
transport = "streamable_http"
url = "https://<your-host>/mcp"

[mcp_servers.sf_docs.headers]
Authorization = "Bearer ${SF_DOCS_MCP_AUTH_TOKEN}"
```

If your client expects a different transport key or schema, keep the same URL/token pattern and adapt field names accordingly.

---

## Deployment

A standard production deployment usually includes:

1. **MCP server** behind HTTPS (load balancer or reverse proxy).
2. **Managed Postgres** for metadata/state.
3. **Managed Qdrant** (or HA self-hosted cluster) for vectors.
4. **Secret management** for `OPENAI_API_KEY` and auth token.
5. **Scheduled crawling/indexing** via CI/CD or job runner.

Recommended deployment checklist:

- Health/readiness endpoints configured.
- Structured logs + request IDs.
- Timeouts/retries for OpenAI and Qdrant calls.
- Backups for Postgres.
- Collection snapshot strategy for Qdrant.
- Blue/green or canary rollout for server updates.

---

## Troubleshooting

### 401 / unauthorized MCP calls

- Ensure `Authorization: Bearer ...` is present.
- Confirm server and client use the same `SF_DOCS_MCP_AUTH_TOKEN`.

### Empty search results

- Verify crawl/index completed successfully.
- Confirm target collection exists in Qdrant.
- Check embedding model consistency between index and query time.

### DB connection failures

- Validate `POSTGRES_URL` host/port/database/user/password.
- Check network/firewall rules from server to Postgres.

### Qdrant errors/timeouts

- Validate `QDRANT_URL` and `QDRANT_API_KEY`.
- Confirm collection name and vector dimensions match your embedding model.

### Slow responses

- Lower `top_k`.
- Add caching for repeated queries.
- Ensure proper Postgres indexes and Qdrant HNSW tuning.

---

## Notes

- Keep this README aligned with real entrypoints/commands in your codebase.
- If module paths differ from examples above, update command snippets to match your implementation.
