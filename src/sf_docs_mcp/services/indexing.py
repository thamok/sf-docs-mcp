from __future__ import annotations

from dataclasses import dataclass
import hashlib
from typing import Any

from sf_docs_mcp.services.embeddings import EmbeddingService
from sf_docs_mcp.services.postgres_store import PostgresStore
from sf_docs_mcp.services.qdrant_store import QdrantStore
from sf_docs_mcp.services.retrieval import default_sparse_encoder


@dataclass(slots=True)
class ChunkInput:
    chunk_index: int
    content: str
    token_count: int
    heading_path: str | None = None
    metadata: dict[str, Any] | None = None


class IndexingService:
    def __init__(self, postgres: PostgresStore, qdrant: QdrantStore, embeddings: EmbeddingService) -> None:
        self.postgres = postgres
        self.qdrant = qdrant
        self.embeddings = embeddings

    def ensure_vector_collection(self) -> None:
        self.qdrant.ensure_collection()

    def upsert_document_with_chunks(
        self,
        *,
        url: str,
        title: str | None,
        canonical_url: str | None,
        source: str,
        language_code: str,
        metadata: dict[str, Any] | None,
        chunks: list[ChunkInput],
    ) -> str:
        page_hash = hashlib.sha256("\n".join(c.content for c in chunks).encode("utf-8")).hexdigest()
        document_id = self.postgres.upsert_document(
            url=url,
            title=title,
            canonical_url=canonical_url,
            source=source,
            language_code=language_code,
            content_hash=page_hash,
            metadata=metadata,
        )

        vectors = self.embeddings.embed_texts([chunk.content for chunk in chunks])
        for chunk, vector in zip(chunks, vectors, strict=True):
            chunk_key = f"{document_id}:{chunk.chunk_index}"
            chunk_id, content_hash = self.postgres.upsert_chunk(
                document_id=document_id,
                chunk_index=chunk.chunk_index,
                chunk_key=chunk_key,
                content=chunk.content,
                token_count=chunk.token_count,
                heading_path=chunk.heading_path,
                metadata=chunk.metadata,
            )
            sparse_indices, sparse_values = default_sparse_encoder(chunk.content)
            self.qdrant.upsert_chunk(
                chunk_id=chunk_id,
                dense_vector=vector,
                sparse_indices=sparse_indices,
                sparse_values=sparse_values,
                payload={
                    "document_id": document_id,
                    "url": url,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "content_hash": content_hash,
                },
            )

        return document_id
