from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Sequence

import psycopg
from psycopg.rows import dict_row


@dataclass(slots=True)
class ChunkRecord:
    id: int
    document_id: int
    chunk_index: int
    content: str
    url: str
    canonical_url: str
    heading_path: str | None
    product_family: str | None
    content_hash: str


class PostgresStore:
    """Persistence layer for documents/chunks/crawl_queue and lexical retrieval."""

    def __init__(self, dsn: str):
        self._dsn = dsn

    def conn(self) -> psycopg.Connection:
        return psycopg.connect(self._dsn, row_factory=dict_row)

    def upsert_document(self, source_url: str, canonical_url: str, title: str | None = None) -> int:
        with self.conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO documents (source_url, canonical_url, title)
                VALUES (%s, %s, %s)
                ON CONFLICT (canonical_url)
                DO UPDATE SET source_url = EXCLUDED.source_url, title = EXCLUDED.title, updated_at = now()
                RETURNING id
                """,
                (source_url, canonical_url, title),
            )
            return int(cur.fetchone()["id"])

    def insert_chunks(self, chunks: Sequence[tuple[int, int, str, str, str, str | None, str | None, str]]) -> list[int]:
        """Insert chunks and return ids.

        Tuple format:
        (document_id, chunk_index, content, url, canonical_url, heading_path, product_family, content_hash)
        """
        sql = """
            INSERT INTO chunks
                (document_id, chunk_index, content, url, canonical_url, heading_path, product_family, content_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (document_id, chunk_index)
            DO UPDATE SET
                content = EXCLUDED.content,
                url = EXCLUDED.url,
                canonical_url = EXCLUDED.canonical_url,
                heading_path = EXCLUDED.heading_path,
                product_family = EXCLUDED.product_family,
                content_hash = EXCLUDED.content_hash,
                updated_at = now()
            RETURNING id
        """
        with self.conn() as conn, conn.cursor() as cur:
            ids: list[int] = []
            for chunk in chunks:
                cur.execute(sql, chunk)
                ids.append(int(cur.fetchone()["id"]))
            return ids

    def enqueue_urls(self, urls: Iterable[str], priority: int = 0) -> None:
        with self.conn() as conn, conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO crawl_queue(url, priority)
                VALUES (%s, %s)
                ON CONFLICT (url) DO NOTHING
                """,
                [(url, priority) for url in urls],
            )

    def mark_crawled(self, url: str, status: str = "completed", error: str | None = None) -> None:
        with self.conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crawl_queue
                SET status = %s,
                    error = %s,
                    crawled_at = %s,
                    updated_at = now()
                WHERE url = %s
                """,
                (status, error, datetime.utcnow(), url),
            )

    def lexical_search(self, query: str, limit: int = 40) -> list[dict]:
        with self.conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.id AS chunk_id,
                    c.document_id AS doc_id,
                    c.url,
                    c.canonical_url,
                    c.heading_path,
                    c.product_family,
                    c.content,
                    ts_rank(c.search_vector, websearch_to_tsquery('english', %s)) AS score
                FROM chunks c
                WHERE c.search_vector @@ websearch_to_tsquery('english', %s)
                ORDER BY score DESC
                LIMIT %s
                """,
                (query, query, limit),
            )
            return list(cur.fetchall())

    def fetch_chunks_by_ids(self, chunk_ids: Sequence[int]) -> list[ChunkRecord]:
        if not chunk_ids:
            return []
        with self.conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, document_id, chunk_index, content, url, canonical_url, heading_path, product_family, content_hash
                FROM chunks
                WHERE id = ANY(%s)
                """,
                (list(chunk_ids),),
            )
            rows = cur.fetchall()
        return [
            ChunkRecord(
                id=row["id"],
                document_id=row["document_id"],
                chunk_index=row["chunk_index"],
                content=row["content"],
                url=row["url"],
                canonical_url=row["canonical_url"],
                heading_path=row["heading_path"],
                product_family=row["product_family"],
                content_hash=row["content_hash"],
            )
            for row in rows
        ]
