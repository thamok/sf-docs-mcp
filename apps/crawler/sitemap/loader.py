from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin
import xml.etree.ElementTree as ET

from apps.crawler.fetch import PoliteFetcher
from apps.crawler.normalize import normalize_url

KNOWN_DOC_SITEMAPS = (
    "docs-atlas-sitemap.xml",
    "docs/ssg-sitemap.xml",
)


@dataclass(slots=True)
class SalesforceSitemapLoader:
    root_url: str
    fetcher: PoliteFetcher

    def fetch_robots_txt(self) -> str:
        robots_url = urljoin(self.root_url, "/robots.txt")
        response = self.fetcher.get(robots_url)
        return response.body.decode("utf-8", errors="replace")

    def discover_sitemaps(self) -> list[str]:
        robots = self.fetch_robots_txt()
        found = []
        for line in robots.splitlines():
            if line.lower().startswith("sitemap:"):
                found.append(normalize_url(line.split(":", 1)[1].strip()))

        # Include required Salesforce docs sitemap files if not explicitly listed.
        for candidate in KNOWN_DOC_SITEMAPS:
            full = normalize_url(urljoin(self.root_url, candidate))
            if full not in found:
                found.append(full)
        return found

    def expand_sitemap(self, sitemap_url: str) -> list[str]:
        response = self.fetcher.get(sitemap_url)
        root = ET.fromstring(response.body)

        ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        if root.tag.endswith("sitemapindex"):
            urls: list[str] = []
            for node in root.findall(f"{ns}sitemap/{ns}loc"):
                nested = normalize_url((node.text or "").strip())
                if nested:
                    urls.extend(self.expand_sitemap(nested))
            return urls

        results: list[str] = []
        for node in root.findall(f"{ns}url/{ns}loc"):
            loc = normalize_url((node.text or "").strip())
            if loc:
                results.append(loc)
        return results

    def load_all_urls(self) -> list[str]:
        collected: list[str] = []
        for sitemap in self.discover_sitemaps():
            collected.extend(self.expand_sitemap(sitemap))
        return sorted(set(collected))
