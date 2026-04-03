import relevanceSet from '../data/relevance-set.json' with { type: 'json' };

type EvalItem = { query: string; relevant: string[] };

type SearchResult = { id: string; score: number };

function mockRetriever(query: string): SearchResult[] {
  const q = query.toLowerCase();
  return [
    { id: q.includes('apex') ? 'apex-triggers' : 'general-overview', score: 0.9 },
    { id: q.includes('flow') ? 'flow-builder' : 'automation', score: 0.8 },
    { id: q.includes('oauth') ? 'oauth-jwt' : 'connected-app', score: 0.7 },
    { id: q.includes('api') ? 'api-limits' : 'metadata-api', score: 0.6 },
    { id: q.includes('cloud') ? 'data-cloud-identity' : 'platform-events', score: 0.5 },
    { id: 'scratch-orgs', score: 0.4 },
    { id: 'debug-logs', score: 0.3 },
    { id: 'reporting-home', score: 0.2 },
    { id: 'security-center', score: 0.1 },
    { id: 'release-notes', score: 0.05 }
  ];
}

function recallAtK(results: string[], relevant: Set<string>, k: number): number {
  const hits = results.slice(0, k).filter((id) => relevant.has(id)).length;
  return relevant.size === 0 ? 0 : hits / relevant.size;
}

function reciprocalRankAtK(results: string[], relevant: Set<string>, k: number): number {
  const idx = results.slice(0, k).findIndex((id) => relevant.has(id));
  return idx === -1 ? 0 : 1 / (idx + 1);
}

function ndcgAtK(results: string[], relevant: Set<string>, k: number): number {
  const dcg = results.slice(0, k).reduce((sum, id, i) => {
    const rel = relevant.has(id) ? 1 : 0;
    return sum + rel / Math.log2(i + 2);
  }, 0);

  const idealLen = Math.min(relevant.size, k);
  const idcg = Array.from({ length: idealLen }).reduce<number>((sum, _, i) => sum + 1 / Math.log2(i + 2), 0);
  return idcg === 0 ? 0 : dcg / idcg;
}

function evaluate(set: EvalItem[]) {
  const totals = { recallAt5: 0, mrrAt10: 0, ndcgAt10: 0 };

  for (const item of set) {
    const results = mockRetriever(item.query).map((r) => r.id);
    const relevant = new Set(item.relevant);

    totals.recallAt5 += recallAtK(results, relevant, 5);
    totals.mrrAt10 += reciprocalRankAtK(results, relevant, 10);
    totals.ndcgAt10 += ndcgAtK(results, relevant, 10);
  }

  return {
    queries: set.length,
    RecallAt5: totals.recallAt5 / set.length,
    MRRAt10: totals.mrrAt10 / set.length,
    nDCGAt10: totals.ndcgAt10 / set.length,
  };
}

const report = evaluate(relevanceSet as EvalItem[]);
console.log(JSON.stringify(report, null, 2));
