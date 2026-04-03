import { assertNumberInRange, assertObject, assertString, JsonSchema } from './common';

export interface StatsInput {
  product_family?: string;
}

export interface StatsOutput {
  total_documents: number;
  indexed_sections: number;
  product_families: string[];
  last_crawl_at: string;
  failed_pages_count: number;
  vector_collection_size: number;
}

export const statsInputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    product_family: { type: 'string', minLength: 1 },
  },
};

export const statsOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'total_documents',
    'indexed_sections',
    'product_families',
    'last_crawl_at',
    'failed_pages_count',
    'vector_collection_size',
  ],
  properties: {
    total_documents: { type: 'integer', minimum: 0 },
    indexed_sections: { type: 'integer', minimum: 0 },
    product_families: { type: 'array', items: { type: 'string', minLength: 1 } },
    last_crawl_at: { type: 'string', format: 'date-time' },
    failed_pages_count: { type: 'integer', minimum: 0 },
    vector_collection_size: { type: 'integer', minimum: 0 },
  },
};

export function validateStatsInput(input: unknown): StatsInput {
  assertObject(input, 'stats input');
  if (input.product_family !== undefined) {
    assertString(input.product_family, 'product_family');
  }
  return input as unknown as StatsInput;
}

export function validateStatsOutput(output: unknown): StatsOutput {
  assertObject(output, 'stats output');
  assertNumberInRange(output.total_documents, 'total_documents', 0, Number.MAX_SAFE_INTEGER);
  assertNumberInRange(output.indexed_sections, 'indexed_sections', 0, Number.MAX_SAFE_INTEGER);
  assertNumberInRange(output.failed_pages_count, 'failed_pages_count', 0, Number.MAX_SAFE_INTEGER);
  assertNumberInRange(output.vector_collection_size, 'vector_collection_size', 0, Number.MAX_SAFE_INTEGER);

  if (!Array.isArray(output.product_families)) {
    throw new Error('product_families must be an array');
  }
  output.product_families.forEach((value, idx) => assertString(value, `product_families[${idx}]`));
  assertString(output.last_crawl_at, 'last_crawl_at');

  return output as unknown as StatsOutput;
}
