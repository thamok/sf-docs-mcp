from __future__ import annotations

import math
import time
from dataclasses import dataclass

from packages.api.app.metrics import REGISTRY


DOCS = [
    {"id": "doc_auth", "text": "Use OAuth bearer tokens for Salesforce APIs."},
    {"id": "doc_bulk", "text": "Bulk API 2.0 supports ingest and query jobs at scale."},
    {"id": "doc_apex", "text": "Apex classes can expose REST endpoints with annotations."},
    {"id": "doc_soql", "text": "SOQL supports filtering and relationship queries."},
    {"id": "doc_events", "text": "Platform events support event-driven integrations."},
]


@dataclass
class SearchResult:
    id: str
    score: float
    text: str


def _embed(text: str) -> dict[str, float]:
    tokens = [tok.lower() for tok in text.split() if tok.strip()]
    denom = max(len(tokens), 1)
    return {t: tokens.count(t) / denom for t in set(tokens)}


def _dot(a: dict[str, float], b: dict[str, float]) -> float:
    return sum(a.get(k, 0.0) * b.get(k, 0.0) for k in set(a) | set(b))


def _norm(v: dict[str, float]) -> float:
    return math.sqrt(sum(x * x for x in v.values()))


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    denom = _norm(a) * _norm(b)
    return _dot(a, b) / denom if denom else 0.0


def search(query: str, k: int = 5) -> list[SearchResult]:
    query_start = time.perf_counter()

    emb_start = time.perf_counter()
    q_vec = _embed(query)
    REGISTRY.embedding_latency.observe((time.perf_counter() - emb_start) * 1000)

    vec_start = time.perf_counter()
    scored = [
        SearchResult(id=d["id"], text=d["text"], score=_cosine(q_vec, _embed(d["text"])))
        for d in DOCS
    ]
    scored.sort(key=lambda r: r.score, reverse=True)
    REGISTRY.vector_latency.observe((time.perf_counter() - vec_start) * 1000)

    REGISTRY.query_latency.observe((time.perf_counter() - query_start) * 1000)
    return scored[:k]
