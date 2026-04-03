from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from .db import PostgresStore
from .vector_store import QdrantVectorStore


@dataclass(slots=True)
class SearchResult:
    chunk_id: int
    doc_id: int
    score: float
    url: str
    canonical_url: str
    heading_path: str | None
    product_family: str | None
    content: str | None = None


class SearchPipeline:
    """Dense + lexical retrieval pipeline with RRF fusion and de-duplication."""

    def __init__(self, pg: PostgresStore, qdrant: QdrantVectorStore):
        self.pg = pg
        self.qdrant = qdrant

    @staticmethod
    def canonicalize_url(url: str) -> str:
        parts = urlsplit(url)
        scheme = parts.scheme.lower() or "https"
        netloc = parts.netloc.lower()
        path = re.sub(r"/+", "/", parts.path).rstrip("/") or "/"
        return urlunsplit((scheme, netloc, path, "", ""))

    @staticmethod
    def _rrf(ranked: list[list[dict]], k: int = 60) -> dict[int, float]:
        fused: dict[int, float] = defaultdict(float)
        for result_set in ranked:
            for idx, row in enumerate(result_set):
                fused[row["chunk_id"]] += 1.0 / (k + idx + 1)
        return dict(fused)

    @staticmethod
    def _near_duplicate_signature(content: str) -> str:
        normalized = re.sub(r"\s+", " ", content).strip().lower()
        return hashlib.sha1(normalized.encode("utf-8")).hexdigest()

    def _deduplicate(self, rows: list[SearchResult]) -> list[SearchResult]:
        seen_per_page: dict[tuple[str, str], int] = {}
        deduped: list[SearchResult] = []
        for row in sorted(rows, key=lambda x: x.score, reverse=True):
            signature = self._near_duplicate_signature(row.content or "")
            key = (row.canonical_url, signature)
            if key in seen_per_page:
                continue
            seen_per_page[key] = row.chunk_id
            deduped.append(row)
        return deduped

    def search(self, query: str, limit: int = 20, reranker=None) -> list[SearchResult]:
        dense = self.qdrant.dense_search(query, limit=40)
        lexical = self.pg.lexical_search(query, limit=40)

        fused_scores = self._rrf([dense, lexical])
        chunks = {c.id: c for c in self.pg.fetch_chunks_by_ids(list(fused_scores.keys()))}

        results = []
        for chunk_id, score in fused_scores.items():
            if chunk_id not in chunks:
                continue
            chunk = chunks[chunk_id]
            canonical_url = self.canonicalize_url(chunk.canonical_url or chunk.url)
            results.append(
                SearchResult(
                    chunk_id=chunk.id,
                    doc_id=chunk.document_id,
                    score=score,
                    url=chunk.url,
                    canonical_url=canonical_url,
                    heading_path=chunk.heading_path,
                    product_family=chunk.product_family,
                    content=chunk.content,
                )
            )

        ranked = sorted(results, key=lambda x: x.score, reverse=True)
        if reranker:
            ranked = reranker(query, ranked)

        deduped = self._deduplicate(ranked)
        return deduped[:limit]
