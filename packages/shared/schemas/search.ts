import {
  assertNumberInRange,
  assertObject,
  assertOptionalString,
  assertOptionalStringArray,
  assertString,
  canonicalizeUrl,
  JsonSchema,
} from './common';

export interface SearchInput {
  query: string;
  top_k: number;
  filters?: {
    product_family?: string;
    section_path_prefix?: string;
    source_types?: string[];
  };
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  product_family: string;
  section_path: string;
}

export interface SearchOutput {
  results: SearchResult[];
}

export const searchInputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['query', 'top_k'],
  properties: {
    query: { type: 'string', minLength: 1 },
    top_k: { type: 'integer', minimum: 1, maximum: 50 },
    filters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        product_family: { type: 'string', minLength: 1 },
        section_path_prefix: { type: 'string', minLength: 1 },
        source_types: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
      },
    },
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
          snippet: { type: 'string', minLength: 1 },
          score: { type: 'number', minimum: 0, maximum: 1 },
          product_family: { type: 'string', minLength: 1 },
          section_path: { type: 'string', minLength: 1 },
        },
      },
    },
  },
};

export function validateSearchInput(input: unknown): SearchInput {
  assertObject(input, 'search input');
  assertString(input.query, 'query');
  assertNumberInRange(input.top_k, 'top_k', 1, 50);

  if (input.filters !== undefined) {
    assertObject(input.filters, 'filters');
    assertOptionalString(input.filters.product_family, 'filters.product_family');
    assertOptionalString(input.filters.section_path_prefix, 'filters.section_path_prefix');
    assertOptionalStringArray(input.filters.source_types, 'filters.source_types');
  }

  return input as SearchInput;
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
    assertString(row.snippet, `results[${idx}].snippet`);
    assertNumberInRange(row.score, `results[${idx}].score`, 0, 1);
    assertString(row.product_family, `results[${idx}].product_family`);
    assertString(row.section_path, `results[${idx}].section_path`);

    return {
      ...row,
      url: canonicalizeUrl(row.url),
    };
  });

  return { results: canonicalResults };
}
