from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(slots=True)
class Settings:
    postgres_dsn: str = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@localhost:5432/sf_docs")
    qdrant_url: str = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key: str | None = os.environ.get("QDRANT_API_KEY")
    qdrant_collection: str = os.environ.get("QDRANT_COLLECTION", "sf_docs_chunks")
    openai_api_key: str | None = os.environ.get("OPENAI_API_KEY")
    embedding_model: str = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")
    embedding_dimensions: int = int(os.environ.get("OPENAI_EMBEDDING_DIMENSIONS", "1024"))
    rerank_enabled: bool = os.environ.get("RERANK_ENABLED", "false").lower() == "true"
