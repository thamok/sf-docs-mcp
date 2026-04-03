from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class Document:
    id: str
    url: str
    title: str | None
    canonical_url: str | None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Chunk:
    id: str
    document_id: str
    chunk_index: int
    content: str
    token_count: int
    content_hash: str
    heading_path: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class SearchHit:
    chunk_id: str
    document_id: str
    url: str
    content: str
    score: float
    source_rank: int
    source: str
