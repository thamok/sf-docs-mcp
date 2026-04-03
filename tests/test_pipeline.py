from packages.api.app.search_engine import DOCS, search
from packages.evals.run_eval import run


def test_extraction_has_documents():
    assert len(DOCS) >= 5


def test_index_search_returns_ranked_results():
    results = search("OAuth bearer token", 3)
    assert results
    assert results[0].score >= results[-1].score


def test_eval_script_metrics_exist():
    metrics = run(__import__("pathlib").Path("packages/evals/data/query_set.jsonl"))
    assert metrics["query_count"] == 50
    assert 0.0 <= metrics["Recall@5"] <= 1.0
    assert 0.0 <= metrics["MRR@10"] <= 1.0
    assert 0.0 <= metrics["nDCG@10"] <= 1.0
