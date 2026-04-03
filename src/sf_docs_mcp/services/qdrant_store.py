from __future__ import annotations

from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models


class QdrantStore:
    def __init__(self, url: str, collection: str, vector_size: int, api_key: str | None = None) -> None:
        self.collection = collection
        self.vector_size = vector_size
        self.client = QdrantClient(url=url, api_key=api_key)

    def ensure_collection(self) -> None:
        collections = self.client.get_collections().collections
        names = {c.name for c in collections}
        if self.collection in names:
            return

        self.client.create_collection(
            collection_name=self.collection,
            vectors_config={
                "dense": models.VectorParams(
                    size=self.vector_size,
                    distance=models.Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "lexical": models.SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=False)
                )
            },
        )

    def upsert_chunk(
        self,
        chunk_id: str,
        dense_vector: list[float],
        payload: dict[str, Any],
        sparse_indices: list[int] | None = None,
        sparse_values: list[float] | None = None,
    ) -> None:
        vector_payload: dict[str, Any] = {"dense": dense_vector}
        if sparse_indices and sparse_values:
            vector_payload["lexical"] = models.SparseVector(indices=sparse_indices, values=sparse_values)

        self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(
                    id=chunk_id,
                    vector=vector_payload,
                    payload=payload,
                )
            ],
            wait=True,
        )

    def dense_search(self, query_vector: list[float], limit: int = 40) -> list[models.ScoredPoint]:
        return self.client.query_points(
            collection_name=self.collection,
            query=query_vector,
            using="dense",
            with_payload=True,
            limit=limit,
        ).points

    def sparse_search(self, sparse_indices: list[int], sparse_values: list[float], limit: int = 40) -> list[models.ScoredPoint]:
        return self.client.query_points(
            collection_name=self.collection,
            query=models.SparseVector(indices=sparse_indices, values=sparse_values),
            using="lexical",
            with_payload=True,
            limit=limit,
        ).points
