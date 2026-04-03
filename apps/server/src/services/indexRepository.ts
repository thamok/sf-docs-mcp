import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FetchInput, FetchOutput } from '../../../../packages/shared/schemas/fetch.js';
import type { GetRelatedInput, GetRelatedOutput } from '../../../../packages/shared/schemas/getRelated.js';
import type { SearchInput, SearchOutput } from '../../../../packages/shared/schemas/search.js';
import type { StatsInput, StatsOutput } from '../../../../packages/shared/schemas/stats.js';
import { canonicalizeUrl } from '../../../../packages/shared/schemas/common.js';

interface IndexRow {
  id: string;
  doc_id: string;
  title: string;
  url: string;
  product_family: string;
  section_path: string[];
  headings: string[];
  source_type: string;
  text: string;
  last_crawled_at: string;
}

interface IndexFile {
  generated_at: string;
  documents: IndexRow[];
  failed_pages: number;
}

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter(Boolean);

const lexicalScore = (queryTokens: string[], haystack: string): number => {
  if (queryTokens.length === 0) return 0;
  const words = tokenize(haystack);
  const set = new Set(words);
  const hits = queryTokens.filter((token) => set.has(token)).length;
  return hits / queryTokens.length;
};

const phraseScore = (query: string, haystack: string): number => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;
  return haystack.toLowerCase().includes(normalizedQuery) ? 1 : 0;
};

const snippetFor = (text: string, query: string): string => {
  const lower = text.toLowerCase();
  const term = query.toLowerCase();
  const index = lower.indexOf(term);
  if (index < 0) {
    return `${text.slice(0, 200)}${text.length > 200 ? '…' : ''}`;
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + term.length + 120);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
};

export class IndexRepository {
  private readonly data: IndexFile;

  constructor(indexPath: string) {
    const absolutePath = resolve(indexPath);
    const raw = readFileSync(absolutePath, 'utf8');
    this.data = JSON.parse(raw) as IndexFile;

    for (const doc of this.data.documents) {
      doc.url = canonicalizeUrl(doc.url);
    }
  }

  async searchDocs(input: SearchInput): Promise<SearchOutput> {
    const topK = input.top_k ?? 8;
    const queryTokens = tokenize(input.query);
    const candidates = this.data.documents
      .filter((doc) => (input.product_family ? doc.product_family === input.product_family : true))
      .filter((doc) => (input.url_prefix ? doc.url.startsWith(input.url_prefix) : true))
      .map((doc) => {
        const body = `${doc.title} ${doc.section_path.join(' ')} ${doc.text}`;
        const lexical = lexicalScore(queryTokens, body);
        const exactPhrase = phraseScore(input.query, body);
        const score = Math.min(1, lexical * 0.7 + exactPhrase * 0.3);
        return { doc, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));

    const deduped = new Set<string>();
    const results = [];

    for (const candidate of candidates) {
      if (results.length >= topK) break;
      const dedupeKey = `${candidate.doc.doc_id}:${candidate.doc.section_path.join('/')}`;
      if (deduped.has(dedupeKey)) continue;
      deduped.add(dedupeKey);

      results.push({
        id: candidate.doc.id,
        title: candidate.doc.title,
        url: candidate.doc.url,
        snippet: input.include_snippets === false ? '' : snippetFor(candidate.doc.text, input.query),
        score: Number(candidate.score.toFixed(4)),
        product_family: candidate.doc.product_family,
        section_path: candidate.doc.section_path,
      });
    }

    return { results };
  }

  async fetchById(input: FetchInput): Promise<FetchOutput> {
    const doc = this.data.documents.find((item) => item.id === input.id || item.doc_id === input.id);
    if (!doc) {
      throw new Error(`Unknown document id: ${input.id}`);
    }

    return {
      id: doc.id,
      title: doc.title,
      text: doc.text,
      url: doc.url,
      metadata: {
        source_type: doc.source_type,
        product_family: doc.product_family,
        section_path: doc.section_path,
        headings: doc.headings,
        last_crawled_at: doc.last_crawled_at,
      },
    };
  }

  async getRelated(input: GetRelatedInput): Promise<GetRelatedOutput> {
    const basis = this.data.documents.find((doc) => doc.id === input.id || doc.doc_id === input.id);
    if (!basis) {
      throw new Error(`Unknown document id: ${input.id}`);
    }

    const basisTokens = new Set(tokenize(`${basis.title} ${basis.section_path.join(' ')} ${basis.text}`));
    const topK = input.top_k ?? 5;

    const related = this.data.documents
      .filter((doc) => doc.id !== basis.id)
      .map((doc) => {
        const tokens = tokenize(`${doc.title} ${doc.section_path.join(' ')} ${doc.text}`);
        const overlap = tokens.filter((token) => basisTokens.has(token)).length;
        const score = overlap / Math.max(basisTokens.size, 1);
        return { doc, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        id: item.doc.id,
        title: item.doc.title,
        url: item.doc.url,
        score: Number(Math.min(1, item.score).toFixed(4)),
      }));

    return { related };
  }

  async getStats(input: StatsInput): Promise<StatsOutput> {
    const docs = input.product_family
      ? this.data.documents.filter((doc) => doc.product_family === input.product_family)
      : this.data.documents;

    const uniqueDocs = new Set(docs.map((doc) => doc.doc_id));
    const families = new Set(docs.map((doc) => doc.product_family));

    return {
      total_documents: uniqueDocs.size,
      indexed_sections: docs.length,
      product_families: [...families].sort(),
      last_crawl_at: this.data.generated_at,
      failed_pages_count: this.data.failed_pages,
      vector_collection_size: this.data.documents.length,
    };
  }

  getFailedPagesCount(): number {
    return this.data.failed_pages;
  }

  getVectorCollectionSize(): number {
    return this.data.documents.length;
  }
}
