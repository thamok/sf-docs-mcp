# Project AGENTS guidance (sample)

## Working agreement
- Prefer small, reviewable pull requests.
- Run `pytest -q` and `python -m packages.evals.run_eval` before committing.
- Keep logs structured as JSON for observability tooling.

## Retrieval changes
- If search ranking logic changes, update `packages/evals/data/query_set.jsonl` and call out expected metric impact.
- Do not reduce eval query count below 50 without explicit approval.

## Deployment changes
- Keep Docker and deployment manifests in sync.
- Document any new required env vars in `docs/container-startup.md`.
