# sf-docs-mcp

Semantic search for Salesforce documentation with hybrid retrieval.

## What's included

- PostgreSQL persistence model + SQL migrations for:
  - `documents`
  - `chunks`
  - `crawl_queue`
- Qdrant collection bootstrap for dense vector search with payload metadata:
  - `doc_id`, `chunk_id`, `url`, `canonical_url`, `heading_path`, `product_family`
- Embedding provider abstraction and OpenAI implementation:
  - `text-embedding-3-large` (supports reduced dimensions)
  - `text-embedding-3-small`
- Lexical retrieval using PostgreSQL full-text search (`tsvector` + `websearch_to_tsquery`)
- Ranking pipeline:
  - dense top-40 + lexical top-40
  - Reciprocal Rank Fusion (RRF)
  - optional reranking hook
  - top-N return
- Result quality controls:
  - canonical URL normalization
  - near-duplicate chunk suppression (same canonical page)

## Layout

- `migrations/0001_init.sql`: schema + indexes
- `migrations/0002_updated_at_triggers.sql`: `updated_at` triggers
- `src/sf_docs_mcp/db.py`: PostgreSQL persistence and lexical retrieval
- `src/sf_docs_mcp/embeddings.py`: provider abstraction + OpenAI provider
- `src/sf_docs_mcp/vector_store.py`: Qdrant collection setup and dense search/upsert
- `src/sf_docs_mcp/pipeline.py`: hybrid retrieval, fusion, rerank hook, dedupe/canonicalization

## Quick start

```bash
pip install -e .
```

Apply SQL migrations with your migration runner of choice (or `psql`).

Instantiate components:

```python
from qdrant_client import QdrantClient

from sf_docs_mcp.db import PostgresStore
from sf_docs_mcp.embeddings import OpenAIEmbeddingProvider
from sf_docs_mcp.pipeline import SearchPipeline
from sf_docs_mcp.vector_store import QdrantVectorStore

pg = PostgresStore(dsn="postgresql://user:pass@localhost:5432/sfdocs")
emb = OpenAIEmbeddingProvider(model="text-embedding-3-large", dimensions=1024)
qdrant = QdrantVectorStore(QdrantClient(url="http://localhost:6333"), "sf_docs", emb)
qdrant.ensure_collection()

pipeline = SearchPipeline(pg=pg, qdrant=qdrant)
results = pipeline.search("how do I configure oauth scopes?", limit=10)
```
