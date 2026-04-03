import { child } from '../logging/logger.js';
import { increment, measureLatency } from '../metrics/metrics.js';

const logger = child({ service: 'pipeline' });

export async function embedQuery(query: string): Promise<number[]> {
  return measureLatency('embedding_latency_ms', async () => {
    await sleep(10);
    return [query.length, 1, 0.5];
  }, { kind: 'query' });
}

export async function vectorSearch(embedding: number[]): Promise<Array<{ id: string; score: number }>> {
  return measureLatency('vector_search_latency_ms', async () => {
    await sleep(6);
    return embedding.map((value, i) => ({ id: `doc-${i + 1}`, score: value }));
  });
}

export async function runSearchQuery(query: string) {
  return measureLatency('query_latency_ms', async () => {
    const embedding = await embedQuery(query);
    const hits = await vectorSearch(embedding);
    logger.info('query_completed', { query, resultCount: hits.length });
    return hits;
  });
}

export async function crawl(url: string): Promise<string> {
  try {
    return await measureLatency('crawl_latency_ms', async () => {
      await sleep(5);
      if (url.includes('bad')) {
        throw new Error('crawler failed to fetch url');
      }
      increment('crawl_success_total');
      return `<html><body>${url}</body></html>`;
    });
  } catch (error) {
    increment('crawl_failure_total');
    logger.warn('crawl_failed', { url, error: String(error) });
    throw error;
  }
}

export async function extract(html: string): Promise<string> {
  try {
    return await measureLatency('extraction_latency_ms', async () => {
      await sleep(4);
      if (!html.includes('<body>')) {
        throw new Error('missing body tag');
      }
      return html.replace(/<[^>]+>/g, ' ').trim();
    });
  } catch (error) {
    increment('extraction_failure_total');
    logger.warn('extraction_failed', { error: String(error) });
    throw error;
  }
}

export async function reEmbedDocument(docId: string, content: string): Promise<void> {
  await measureLatency('embedding_latency_ms', async () => {
    await sleep(8);
    logger.info('document_reembedded', { docId, bytes: content.length });
  }, { kind: 'document' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
