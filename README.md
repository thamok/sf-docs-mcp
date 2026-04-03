# sf-docs-mcp

Semantic search backend for Salesforce documentation with persistent storage and hybrid retrieval.

## What is implemented

- Postgres schema migration for:
  - `documents`
  - `chunks`
  - `crawl_queue`
- Qdrant collection setup for dense vectors and optional sparse vectors.
- OpenAI embedding service for:
  - `text-embedding-3-large` (configurable dimensions up to 3072; default 1024)
  - `text-embedding-3-small`
- Hybrid retrieval pipeline:
  - dense top 40
  - lexical top 40 (Postgres `tsvector` or Qdrant sparse)
  - reciprocal rank fusion (RRF)
  - optional rerank top 20 (pluggable reranker)
  - return top 8
- Near-duplicate suppression for same URL/near-identical chunks.
- Service container that exposes backend operations for MCP tool handlers.

## Key modules

- `db/migrations/001_init_persistence.sql`
- `src/sf_docs_mcp/services/postgres_store.py`
- `src/sf_docs_mcp/services/qdrant_store.py`
- `src/sf_docs_mcp/services/embeddings.py`
- `src/sf_docs_mcp/services/retrieval.py`
- `src/sf_docs_mcp/services/indexing.py`
- `src/sf_docs_mcp/services/mcp_operations.py`

## Notes

- Run the SQL migration before using the service.
- Set `OPENAI_API_KEY`, `POSTGRES_DSN`, and `QDRANT_URL` in your environment.
