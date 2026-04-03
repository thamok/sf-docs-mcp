from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher
import re
from typing import Callable

from sf_docs_mcp.models import SearchHit
from typing import Protocol
from sf_docs_mcp.services.text_utils import normalize_text


@dataclass(slots=True)
class RetrievalConfig:
    dense_k: int = 40
    lexical_k: int = 40
    rerank_k: int = 20
    final_k: int = 8
    rrf_k: int = 60
    dedupe_similarity_threshold: float = 0.95


class EmbeddingProvider(Protocol):
    def embed_query(self, query: str) -> list[float]: ...


class DenseStore(Protocol):
    def dense_search(self, query_vector: list[float], limit: int = 40): ...
    def sparse_search(self, sparse_indices: list[int], sparse_values: list[float], limit: int = 40): ...


class RetrievalService:
    def __init__(
        self,
        *,
        embeddings: EmbeddingProvider,
        qdrant: DenseStore,
        lexical_search: Callable[[str, int], list[SearchHit]],
        reranker: Callable[[str, list[SearchHit]], list[SearchHit]] | None = None,
        sparse_encoder: Callable[[str], tuple[list[int], list[float]]] | None = None,
        use_qdrant_sparse: bool = False,
        config: RetrievalConfig | None = None,
    ) -> None:
        self.embeddings = embeddings
        self.qdrant = qdrant
        self.lexical_search = lexical_search
        self.reranker = reranker
        self.sparse_encoder = sparse_encoder or default_sparse_encoder
        self.use_qdrant_sparse = use_qdrant_sparse
        self.config = config or RetrievalConfig()

    def search(self, query: str) -> list[SearchHit]:
        query_vector = self.embeddings.embed_query(query)

        dense_points = self.qdrant.dense_search(query_vector=query_vector, limit=self.config.dense_k)
        dense_hits = [
            SearchHit(
                chunk_id=str(point.id),
                document_id=str(point.payload["document_id"]),
                url=str(point.payload["url"]),
                content=str(point.payload["content"]),
                score=float(point.score),
                source_rank=i + 1,
                source="dense",
            )
            for i, point in enumerate(dense_points)
        ]

        if self.use_qdrant_sparse:
            s_idx, s_vals = self.sparse_encoder(query)
            sparse_points = self.qdrant.sparse_search(sparse_indices=s_idx, sparse_values=s_vals, limit=self.config.lexical_k)
            lexical_hits = [
                SearchHit(
                    chunk_id=str(point.id),
                    document_id=str(point.payload["document_id"]),
                    url=str(point.payload["url"]),
                    content=str(point.payload["content"]),
                    score=float(point.score),
                    source_rank=i + 1,
                    source="sparse",
                )
                for i, point in enumerate(sparse_points)
            ]
        else:
            lexical_hits = self.lexical_search(query, self.config.lexical_k)

        fused = self._reciprocal_rank_fusion([dense_hits, lexical_hits])
        fused = self._suppress_near_duplicates(fused)

        if self.reranker:
            rerank_window = fused[: self.config.rerank_k]
            reranked = self.reranker(query, rerank_window)
            tail = fused[self.config.rerank_k :]
            fused = reranked + tail

        return fused[: self.config.final_k]

    def _reciprocal_rank_fusion(self, result_sets: list[list[SearchHit]]) -> list[SearchHit]:
        by_chunk: dict[str, SearchHit] = {}
        scores = defaultdict(float)

        for result_set in result_sets:
            for rank, hit in enumerate(result_set, start=1):
                scores[hit.chunk_id] += 1.0 / (self.config.rrf_k + rank)
                by_chunk.setdefault(hit.chunk_id, hit)

        ranked_ids = sorted(scores, key=scores.get, reverse=True)
        merged: list[SearchHit] = []
        for i, chunk_id in enumerate(ranked_ids, start=1):
            base = by_chunk[chunk_id]
            merged.append(
                SearchHit(
                    chunk_id=base.chunk_id,
                    document_id=base.document_id,
                    url=base.url,
                    content=base.content,
                    score=scores[chunk_id],
                    source_rank=i,
                    source="hybrid_rrf",
                )
            )
        return merged

    def _suppress_near_duplicates(self, hits: list[SearchHit]) -> list[SearchHit]:
        selected: list[SearchHit] = []
        seen_by_url: dict[str, list[str]] = defaultdict(list)

        for hit in hits:
            text = normalize_text(hit.content)
            per_url = seen_by_url[hit.url]
            is_duplicate = False
            for prior in per_url:
                if text == prior:
                    is_duplicate = True
                    break
                similarity = SequenceMatcher(None, text, prior).ratio()
                if similarity >= self.config.dedupe_similarity_threshold:
                    is_duplicate = True
                    break

            if not is_duplicate:
                selected.append(hit)
                per_url.append(text)

        return selected


def default_sparse_encoder(query: str) -> tuple[list[int], list[float]]:
    # Simple hashed sparse representation that can be replaced with BM25/splade encoder.
    tokens = [t for t in re.split(r"\W+", query.lower()) if t]
    scores: dict[int, float] = defaultdict(float)
    for token in tokens:
        idx = hash(token) % 50000
        scores[idx] += 1.0
    indices = list(scores.keys())
    values = [scores[i] for i in indices]
    return indices, values
