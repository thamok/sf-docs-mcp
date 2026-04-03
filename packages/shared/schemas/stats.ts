import { assertNumberInRange, assertObject, assertString, JsonSchema } from './common';

export interface StatsInput {
  product_family?: string;
}

export interface StatsOutput {
  total_documents: number;
  indexed_sections: number;
  product_families: string[];
  last_crawl_at: string;
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
  required: ['total_documents', 'indexed_sections', 'product_families', 'last_crawl_at'],
  properties: {
    total_documents: { type: 'integer', minimum: 0 },
    indexed_sections: { type: 'integer', minimum: 0 },
    product_families: { type: 'array', items: { type: 'string', minLength: 1 } },
    last_crawl_at: { type: 'string', format: 'date-time' },
  },
};

export function validateStatsInput(input: unknown): StatsInput {
  assertObject(input, 'stats input');
  if (input.product_family !== undefined) {
    assertString(input.product_family, 'product_family');
  }
  return input as StatsInput;
}

export function validateStatsOutput(output: unknown): StatsOutput {
  assertObject(output, 'stats output');
  assertNumberInRange(output.total_documents, 'total_documents', 0, Number.MAX_SAFE_INTEGER);
  assertNumberInRange(output.indexed_sections, 'indexed_sections', 0, Number.MAX_SAFE_INTEGER);

  if (!Array.isArray(output.product_families)) {
    throw new Error('product_families must be an array');
  }
  output.product_families.forEach((value, idx) => assertString(value, `product_families[${idx}]`));
  assertString(output.last_crawl_at, 'last_crawl_at');

  return output as StatsOutput;
}
