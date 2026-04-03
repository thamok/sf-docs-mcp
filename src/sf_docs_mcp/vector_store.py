from __future__ import annotations

from typing import Any, Sequence

from qdrant_client import QdrantClient
from qdrant_client.http import models

from .embeddings import EmbeddingProvider


class QdrantVectorStore:
    def __init__(self, client: QdrantClient, collection: str, embeddings: EmbeddingProvider):
        self.client = client
        self.collection = collection
        self.embeddings = embeddings

    def ensure_collection(self) -> None:
        existing = {c.name for c in self.client.get_collections().collections}
        if self.collection in existing:
            return

        self.client.create_collection(
            collection_name=self.collection,
            vectors_config=models.VectorParams(
                size=self.embeddings.dimensions,
                distance=models.Distance.COSINE,
            ),
            on_disk_payload=True,
        )
        self.client.create_payload_index(self.collection, "doc_id", models.PayloadSchemaType.INTEGER)
        self.client.create_payload_index(self.collection, "chunk_id", models.PayloadSchemaType.INTEGER)
        self.client.create_payload_index(self.collection, "url", models.PayloadSchemaType.KEYWORD)
        self.client.create_payload_index(self.collection, "canonical_url", models.PayloadSchemaType.KEYWORD)
        self.client.create_payload_index(self.collection, "heading_path", models.PayloadSchemaType.TEXT)
        self.client.create_payload_index(self.collection, "product_family", models.PayloadSchemaType.KEYWORD)

    def upsert_chunks(self, points: Sequence[dict[str, Any]]) -> None:
        """Each point requires id, text, and payload keys."""
        vectors = self.embeddings.embed([p["text"] for p in points])
        to_upsert = [
            models.PointStruct(id=p["id"], vector=vectors[idx], payload=p["payload"])
            for idx, p in enumerate(points)
        ]
        self.client.upsert(collection_name=self.collection, points=to_upsert, wait=True)

    def dense_search(self, query: str, limit: int = 40) -> list[dict[str, Any]]:
        vector = self.embeddings.embed([query])[0]
        hits = self.client.search(
            collection_name=self.collection,
            query_vector=vector,
            limit=limit,
            with_payload=True,
        )
        return [
            {
                "chunk_id": int(hit.payload["chunk_id"]),
                "doc_id": int(hit.payload["doc_id"]),
                "url": hit.payload.get("url"),
                "canonical_url": hit.payload.get("canonical_url"),
                "heading_path": hit.payload.get("heading_path"),
                "product_family": hit.payload.get("product_family"),
                "score": float(hit.score),
            }
            for hit in hits
        ]
