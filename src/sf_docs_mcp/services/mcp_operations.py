from __future__ import annotations

from sf_docs_mcp.config import Settings
from sf_docs_mcp.services.embeddings import EmbeddingService
from sf_docs_mcp.services.indexing import ChunkInput, IndexingService
from sf_docs_mcp.services.postgres_store import PostgresStore
from sf_docs_mcp.services.qdrant_store import QdrantStore
from sf_docs_mcp.services.retrieval import RetrievalService


class MCPServiceContainer:
    """Container exposing backend operations for MCP tool handlers."""

    def __init__(self, settings: Settings) -> None:
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required")

        self.settings = settings
        self.postgres = PostgresStore(settings.postgres_dsn)
        self.embeddings = EmbeddingService(
            api_key=settings.openai_api_key,
            model=settings.embedding_model,
            dimensions=settings.embedding_dimensions,
        )
        self.qdrant = QdrantStore(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            collection=settings.qdrant_collection,
            vector_size=settings.embedding_dimensions,
        )
        self.indexing = IndexingService(self.postgres, self.qdrant, self.embeddings)
        self.retrieval = RetrievalService(
            embeddings=self.embeddings,
            qdrant=self.qdrant,
            lexical_search=self.postgres.lexical_search,
            use_qdrant_sparse=False,
        )

    def setup_storage(self) -> None:
        self.indexing.ensure_vector_collection()

    def ingest_document(self, *, url: str, title: str | None, chunks: list[ChunkInput]) -> str:
        return self.indexing.upsert_document_with_chunks(
            url=url,
            title=title,
            canonical_url=None,
            source="crawl",
            language_code="en",
            metadata=None,
            chunks=chunks,
        )

    def enqueue_crawl(self, url: str, depth: int = 0, priority: int = 100) -> None:
        self.postgres.enqueue_url(url=url, depth=depth, priority=priority)

    def search(self, query: str) -> list[dict[str, str | float]]:
        hits = self.retrieval.search(query)
        return [
            {
                "chunk_id": h.chunk_id,
                "document_id": h.document_id,
                "url": h.url,
                "content": h.content,
                "score": h.score,
            }
            for h in hits
        ]
