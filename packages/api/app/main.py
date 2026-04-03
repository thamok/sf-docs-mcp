from __future__ import annotations

import time
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from packages.api.app.config import load_settings
from packages.api.app.logging_utils import log_event
from packages.api.app.metrics import REGISTRY
from packages.api.app.search_engine import search

settings = load_settings()
app = FastAPI(title="sf-docs-mcp")

if settings.cors_allowlist:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_allowlist),
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def auth_and_origin_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and settings.cors_allowlist and origin not in settings.cors_allowlist:
        log_event("cors_rejected", origin=origin, path=request.url.path)
        raise HTTPException(status_code=403, detail="Origin not allowed")

    if settings.hosted_mode:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing bearer token")
        token = auth.split(" ", 1)[1]
        if token != settings.bearer_token:
            raise HTTPException(status_code=401, detail="Invalid bearer token")

    req_start = time.perf_counter()
    response = await call_next(request)
    latency_ms = (time.perf_counter() - req_start) * 1000
    log_event(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        latency_ms=round(latency_ms, 3),
    )
    return response


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    k: int = Field(default=5, ge=1, le=20)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    return REGISTRY.export()


@app.post("/search")
def search_endpoint(payload: SearchRequest) -> dict[str, Any]:
    results = search(payload.query, payload.k)
    return {"results": [r.__dict__ for r in results]}


@app.post("/crawl")
def crawl(urls: list[str]) -> dict[str, int]:
    for u in urls:
        if u.startswith("http://") or u.startswith("https://"):
            REGISTRY.crawl_success.inc()
        else:
            REGISTRY.crawl_failure.inc()
    return {
        "crawl_success": REGISTRY.crawl_success.value,
        "crawl_failure": REGISTRY.crawl_failure.value,
    }
