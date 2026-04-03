# Evals Harness

This harness evaluates retrieval quality using:

- Recall@5
- MRR@10
- nDCG@10

Run locally:

```bash
python -m packages.evals.run_eval
```

The query set lives in `packages/evals/data/query_set.jsonl` and includes 50 examples.
