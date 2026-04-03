from __future__ import annotations

import random
import time
from dataclasses import dataclass
from typing import Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


@dataclass(slots=True)
class CachedResponse:
    url: str
    status_code: int
    headers: dict[str, str]
    body: bytes
    not_modified: bool = False


class PoliteFetcher:
    """HTTP fetcher with retries, backoff, per-host rate limiting, and conditional requests."""

    def __init__(
        self,
        *,
        timeout_seconds: float = 20.0,
        max_retries: int = 3,
        backoff_seconds: float = 0.75,
        rate_limit_seconds: float = 0.5,
        user_agent: str = "sf-docs-crawler/0.1",
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds
        self.rate_limit_seconds = rate_limit_seconds
        self.user_agent = user_agent
        self._last_request_by_host: dict[str, float] = {}

    def get(
        self,
        url: str,
        *,
        etag: str | None = None,
        last_modified: str | None = None,
        extra_headers: Mapping[str, str] | None = None,
    ) -> CachedResponse:
        headers = {"User-Agent": self.user_agent}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified
        if extra_headers:
            headers.update(dict(extra_headers))

        for attempt in range(1, self.max_retries + 1):
            self._respect_rate_limit(url)
            req = Request(url=url, headers=headers, method="GET")
            try:
                with urlopen(req, timeout=self.timeout_seconds) as response:
                    payload = response.read()
                    return CachedResponse(
                        url=response.geturl(),
                        status_code=response.status,
                        headers={k.lower(): v for k, v in response.headers.items()},
                        body=payload,
                    )
            except HTTPError as exc:
                if exc.code == 304:
                    return CachedResponse(
                        url=url,
                        status_code=304,
                        headers={k.lower(): v for k, v in exc.headers.items()},
                        body=b"",
                        not_modified=True,
                    )
                if 400 <= exc.code < 500 and exc.code not in (408, 429):
                    raise
                self._sleep_backoff(attempt)
            except URLError:
                self._sleep_backoff(attempt)

        raise RuntimeError(f"Failed to fetch {url} after {self.max_retries} attempts")

    def _respect_rate_limit(self, url: str) -> None:
        host = urlparse(url).netloc.lower()
        now = time.monotonic()
        last = self._last_request_by_host.get(host)
        if last is not None:
            elapsed = now - last
            if elapsed < self.rate_limit_seconds:
                time.sleep(self.rate_limit_seconds - elapsed)
        self._last_request_by_host[host] = time.monotonic()

    def _sleep_backoff(self, attempt: int) -> None:
        sleep = self.backoff_seconds * (2 ** (attempt - 1))
        sleep += random.uniform(0.0, 0.2 * self.backoff_seconds)
        time.sleep(sleep)
