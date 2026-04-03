from __future__ import annotations

import json
from pathlib import Path

from packages.api.app.search_engine import search
from packages.evals.metrics import mrr_at_k, ndcg_at_k, recall_at_k


def load_query_set(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def run(path: Path) -> dict[str, float]:
    query_set = load_query_set(path)
    recall_scores = []
    mrr_scores = []
    ndcg_scores = []

    for item in query_set:
        ranked = [r.id for r in search(str(item["query"]), 10)]
        rel = set(item["relevant_ids"])
        recall_scores.append(recall_at_k(rel, ranked, 5))
        mrr_scores.append(mrr_at_k(rel, ranked, 10))
        ndcg_scores.append(ndcg_at_k(rel, ranked, 10))

    n = max(len(query_set), 1)
    return {
        "query_count": len(query_set),
        "Recall@5": sum(recall_scores) / n,
        "MRR@10": sum(mrr_scores) / n,
        "nDCG@10": sum(ndcg_scores) / n,
    }


if __name__ == "__main__":
    path = Path("packages/evals/data/query_set.jsonl")
    results = run(path)
    print(json.dumps(results, indent=2))
