from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from apps.crawler.fetch import PoliteFetcher

DEFAULT_QUERY_WHITELIST = frozenset({"lang", "language", "locale", "version"})


def normalize_url(url: str, *, query_whitelist: set[str] | frozenset[str] = DEFAULT_QUERY_WHITELIST) -> str:
    parts = urlsplit(url)
    host = parts.netloc.lower()
    path = parts.path or "/"
    query = ""
    if parts.query:
        keep = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k in query_whitelist]
        query = urlencode(sorted(keep), doseq=True)
    return urlunsplit((parts.scheme.lower(), host, path, query, ""))


def resolve_redirect(url: str, fetcher: PoliteFetcher) -> str:
    response = fetcher.get(url)
    return normalize_url(response.url)
