from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from urllib.parse import urlsplit

from apps.crawler.types import CrawlDocument, CrawlResult, CrawlStatus, UrlRecord

OFFICIAL_DOC_HOSTS = {
    "developer.salesforce.com",
    "help.salesforce.com",
    "trailhead.salesforce.com",
    "www.salesforce.com",
}


def is_official_salesforce_doc_url(url: str) -> bool:
    parts = urlsplit(url)
    host = parts.netloc.lower()
    if host not in OFFICIAL_DOC_HOSTS:
        return False

    # Keep docs-like paths only.
    path = parts.path.lower()
    return any(
        token in path
        for token in (
            "/docs",
            "/article",
            "/content/learn",
            "/atlas.",
            "/s/article",
        )
    )


class CrawlIndexStore:
    """Simple JSONL persistence for crawled docs, chunks, and embedding queues."""

    def __init__(self, root: str | Path = "var/crawler") -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.docs_path = self.root / "documents.jsonl"
        self.chunks_path = self.root / "chunks.jsonl"
        self.queue_path = self.root / "embedding_queue.jsonl"
        self.status_path = self.root / "crawl_status.jsonl"

    def persist(self, result: CrawlResult) -> None:
        doc = result.document
        self._append_jsonl(self.docs_path, asdict(doc))

        for index, chunk in enumerate(result.chunks):
            payload = {
                "doc_id": doc.doc_id,
                "chunk_id": f"{doc.doc_id}:{index}",
                "canonical_url": doc.canonical_url,
                "heading": chunk.get("heading", ""),
                "text": chunk.get("text", ""),
            }
            self._append_jsonl(self.chunks_path, payload)
            self._append_jsonl(self.queue_path, payload)

        self._append_jsonl(
            self.status_path,
            asdict(
                UrlRecord(
                    url=doc.canonical_url,
                    status=doc.status,
                    attempts=1,
                    fetched_at=doc.crawled_at,
                )
            ),
        )

    def persist_failed(self, url: str, error: str, attempts: int) -> None:
        self._append_jsonl(
            self.status_path,
            asdict(
                UrlRecord(
                    url=url,
                    status=CrawlStatus.FAILED,
                    attempts=attempts,
                    last_error=error,
                )
            ),
        )

    def persist_needs_render(self, url: str) -> None:
        self._append_jsonl(
            self.status_path,
            asdict(UrlRecord(url=url, status=CrawlStatus.NEEDS_RENDER, attempts=1)),
        )

    def _append_jsonl(self, path: Path, payload: dict) -> None:
        serializable = _json_default(payload)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(serializable, ensure_ascii=False) + "\n")


def _json_default(payload: dict) -> dict:
    normalized = {}
    for key, value in payload.items():
        if isinstance(value, CrawlStatus):
            normalized[key] = value.value
        elif hasattr(value, "isoformat"):
            normalized[key] = value.isoformat()
        elif isinstance(value, dict):
            normalized[key] = _json_default(value)
        else:
            normalized[key] = value
    return normalized
