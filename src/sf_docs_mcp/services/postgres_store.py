from __future__ import annotations

import hashlib
from typing import Any

from sf_docs_mcp.models import SearchHit
from sf_docs_mcp.services.db import get_connection
from sf_docs_mcp.services.text_utils import normalize_text


def hash_text(text: str) -> str:
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()


class PostgresStore:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def upsert_document(
        self,
        *,
        url: str,
        title: str | None,
        canonical_url: str | None,
        source: str,
        language_code: str,
        content_hash: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        metadata = metadata or {}
        with get_connection(self.dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (url, title, canonical_url, source, language_code, content_hash, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (url)
                DO UPDATE SET
                    title = EXCLUDED.title,
                    canonical_url = EXCLUDED.canonical_url,
                    content_hash = EXCLUDED.content_hash,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                RETURNING id
                """,
                (url, title, canonical_url, source, language_code, content_hash, metadata),
            )
            return str(cur.fetchone()["id"])

    def upsert_chunk(
        self,
        *,
        document_id: str,
        chunk_index: int,
        chunk_key: str,
        content: str,
        token_count: int,
        heading_path: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> tuple[str, str]:
        metadata = metadata or {}
        content_hash = hash_text(content)
        with get_connection(self.dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chunks (
                    document_id, chunk_index, chunk_key, content, content_hash, token_count, heading_path, metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (document_id, chunk_index)
                DO UPDATE SET
                    content = EXCLUDED.content,
                    content_hash = EXCLUDED.content_hash,
                    token_count = EXCLUDED.token_count,
                    heading_path = EXCLUDED.heading_path,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                RETURNING id, content_hash
                """,
                (document_id, chunk_index, chunk_key, content, content_hash, token_count, heading_path, metadata),
            )
            row = cur.fetchone()
            return str(row["id"]), str(row["content_hash"])

    def enqueue_url(self, url: str, depth: int = 0, priority: int = 100, metadata: dict[str, Any] | None = None) -> None:
        metadata = metadata or {}
        with get_connection(self.dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crawl_queue (url, depth, priority, metadata)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (url)
                DO UPDATE SET
                    priority = LEAST(crawl_queue.priority, EXCLUDED.priority),
                    metadata = crawl_queue.metadata || EXCLUDED.metadata,
                    updated_at = NOW()
                """,
                (url, depth, priority, metadata),
            )

    def lexical_search(self, query: str, limit: int = 40) -> list[SearchHit]:
        with get_connection(self.dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                WITH query_ts AS (SELECT websearch_to_tsquery('english', %s) AS q)
                SELECT
                    c.id::text AS chunk_id,
                    c.document_id::text AS document_id,
                    d.url AS url,
                    c.content AS content,
                    ts_rank_cd(c.search_vector, query_ts.q) AS score
                FROM chunks c
                JOIN documents d ON d.id = c.document_id
                JOIN query_ts ON TRUE
                WHERE c.search_vector @@ query_ts.q
                ORDER BY score DESC
                LIMIT %s
                """,
                (query, limit),
            )
            rows = cur.fetchall()

        return [
            SearchHit(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                url=row["url"],
                content=row["content"],
                score=float(row["score"]),
                source_rank=i + 1,
                source="lexical",
            )
            for i, row in enumerate(rows)
        ]
