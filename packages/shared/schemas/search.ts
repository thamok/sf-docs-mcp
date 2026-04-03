import {
  assertNumberInRange,
  assertObject,
  assertOptionalString,
  assertString,
  canonicalizeUrl,
  JsonSchema,
} from './common';

export interface SearchInput {
  query: string;
  top_k?: number;
  product_family?: string;
  url_prefix?: string;
  include_snippets?: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  product_family: string;
  section_path: string[];
}

export interface SearchOutput {
  results: SearchResult[];
}

export const searchInputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1 },
    top_k: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
    product_family: { type: 'string', minLength: 1 },
    url_prefix: { type: 'string', minLength: 1 },
    include_snippets: { type: 'boolean', default: true },
  },
};

export const searchOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'url', 'snippet', 'score', 'product_family', 'section_path'],
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          url: { type: 'string', format: 'uri' },
          snippet: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          product_family: { type: 'string', minLength: 1 },
          section_path: { type: 'array', items: { type: 'string', minLength: 1 } },
        },
      },
    },
  },
};

export function validateSearchInput(input: unknown): SearchInput {
  assertObject(input, 'search input');
  assertString(input.query, 'query');

  if (input.top_k !== undefined) {
    assertNumberInRange(input.top_k, 'top_k', 1, 20);
  }

  assertOptionalString(input.product_family, 'product_family');
  assertOptionalString(input.url_prefix, 'url_prefix');

  if (input.include_snippets !== undefined && typeof input.include_snippets !== 'boolean') {
    throw new Error('include_snippets must be a boolean when provided');
  }

  return input as unknown as SearchInput;
}

export function validateSearchOutput(output: unknown): SearchOutput {
  assertObject(output, 'search output');
  if (!Array.isArray(output.results)) {
    throw new Error('results must be an array');
  }

  const canonicalResults = output.results.map((row, idx) => {
    assertObject(row, `results[${idx}]`);
    assertString(row.id, `results[${idx}].id`);
    assertString(row.title, `results[${idx}].title`);
    assertString(row.url, `results[${idx}].url`);
    if (typeof row.snippet !== 'string') {
      throw new Error(`results[${idx}].snippet must be a string`);
    }
    assertNumberInRange(row.score, `results[${idx}].score`, 0, 1);
    assertString(row.product_family, `results[${idx}].product_family`);
    if (!Array.isArray(row.section_path)) {
      throw new Error(`results[${idx}].section_path must be an array`);
    }
    row.section_path.forEach((part, sectionIdx) =>
      assertString(part, `results[${idx}].section_path[${sectionIdx}]`),
    );

    return {
      ...(row as any),
      url: canonicalizeUrl(row.url),
    };
  });

  return { results: canonicalResults };
}
