from __future__ import annotations

import hashlib

from apps.crawler.chunk import chunk_by_headings
from apps.crawler.extract import extract_content
from apps.crawler.fetch import PoliteFetcher
from apps.crawler.index import CrawlIndexStore, is_official_salesforce_doc_url
from apps.crawler.normalize import normalize_url
from apps.crawler.types import CrawlDocument, CrawlResult, CrawlStatus


class SalesforceCrawlerPipeline:
    def __init__(self, fetcher: PoliteFetcher, index_store: CrawlIndexStore) -> None:
        self.fetcher = fetcher
        self.index_store = index_store

    def crawl_one(
        self,
        url: str,
        *,
        etag: str | None = None,
        last_modified: str | None = None,
    ) -> CrawlResult | None:
        canonical = normalize_url(url)
        if not is_official_salesforce_doc_url(canonical):
            return None

        response = self.fetcher.get(canonical, etag=etag, last_modified=last_modified)
        if response.not_modified:
            return None

        content_type = response.headers.get("content-type", "")
        extracted = extract_content(content_type, response.body)
        if self._requires_render(extracted):
            self.index_store.persist_needs_render(canonical)
            return None

        doc = CrawlDocument(
            doc_id=self._doc_id(canonical),
            url=url,
            canonical_url=canonical,
            source_type="pdf" if "pdf" in content_type.lower() else "html",
            extracted=extracted,
            status=CrawlStatus.CRAWLED,
            etag=response.headers.get("etag"),
            last_modified=response.headers.get("last-modified"),
        )
        chunks = chunk_by_headings(extracted)
        result = CrawlResult(document=doc, chunks=chunks, embedding_enqueued=True)
        self.index_store.persist(result)
        return result

    def crawl_many(self, urls: list[str]) -> list[CrawlResult]:
        results: list[CrawlResult] = []
        for url in urls:
            try:
                item = self.crawl_one(url)
                if item:
                    results.append(item)
            except Exception as exc:  # noqa: BLE001
                self.index_store.persist_failed(url, str(exc), attempts=1)
        return results

    @staticmethod
    def _requires_render(extracted_content) -> bool:
        body = extracted_content.body.strip()
        return not body or "enable javascript" in body.lower()

    @staticmethod
    def _doc_id(canonical_url: str) -> str:
        return hashlib.sha1(canonical_url.encode("utf-8"), usedforsecurity=False).hexdigest()
