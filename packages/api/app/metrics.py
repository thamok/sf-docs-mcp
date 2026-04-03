from __future__ import annotations

from dataclasses import dataclass, field
from statistics import mean


@dataclass
class Histogram:
    samples_ms: list[float] = field(default_factory=list)

    def observe(self, sample_ms: float) -> None:
        self.samples_ms.append(sample_ms)

    def summary(self) -> dict[str, float | int]:
        values = self.samples_ms
        return {
            "count": len(values),
            "avg_ms": round(mean(values), 3) if values else 0.0,
            "max_ms": round(max(values), 3) if values else 0.0,
        }


@dataclass
class Counter:
    value: int = 0

    def inc(self, count: int = 1) -> None:
        self.value += count


@dataclass
class MetricsRegistry:
    query_latency: Histogram = field(default_factory=Histogram)
    embedding_latency: Histogram = field(default_factory=Histogram)
    vector_latency: Histogram = field(default_factory=Histogram)
    crawl_success: Counter = field(default_factory=Counter)
    crawl_failure: Counter = field(default_factory=Counter)

    def export(self) -> dict[str, object]:
        return {
            "query_latency": self.query_latency.summary(),
            "embedding_latency": self.embedding_latency.summary(),
            "vector_latency": self.vector_latency.summary(),
            "crawl_success": self.crawl_success.value,
            "crawl_failure": self.crawl_failure.value,
        }


REGISTRY = MetricsRegistry()
