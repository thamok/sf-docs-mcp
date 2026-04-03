import { assertObject, assertString, canonicalizeUrl, JsonSchema } from './common';

export interface FetchInput {
  id: string;
}

export interface FetchOutput {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata: {
    source_type: string;
    product_family: string;
    section_path: string;
    headings: string[];
    last_crawled_at: string;
  };
}

export const fetchInputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
  },
};

export const fetchOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'text', 'url', 'metadata'],
  properties: {
    id: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    text: { type: 'string', minLength: 1 },
    url: { type: 'string', format: 'uri' },
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: ['source_type', 'product_family', 'section_path', 'headings', 'last_crawled_at'],
      properties: {
        source_type: { type: 'string', minLength: 1 },
        product_family: { type: 'string', minLength: 1 },
        section_path: { type: 'string', minLength: 1 },
        headings: { type: 'array', items: { type: 'string', minLength: 1 } },
        last_crawled_at: { type: 'string', format: 'date-time' },
      },
    },
  },
};

export function validateFetchInput(input: unknown): FetchInput {
  assertObject(input, 'fetch input');
  assertString(input.id, 'id');
  return input as FetchInput;
}

export function validateFetchOutput(output: unknown): FetchOutput {
  assertObject(output, 'fetch output');
  assertString(output.id, 'id');
  assertString(output.title, 'title');
  assertString(output.text, 'text');
  assertString(output.url, 'url');
  assertObject(output.metadata, 'metadata');
  assertString(output.metadata.source_type, 'metadata.source_type');
  assertString(output.metadata.product_family, 'metadata.product_family');
  assertString(output.metadata.section_path, 'metadata.section_path');

  if (!Array.isArray(output.metadata.headings)) {
    throw new Error('metadata.headings must be an array of strings');
  }
  output.metadata.headings.forEach((h, i) => assertString(h, `metadata.headings[${i}]`));
  assertString(output.metadata.last_crawled_at, 'metadata.last_crawled_at');

  return {
    ...(output as Omit<FetchOutput, 'url'>),
    url: canonicalizeUrl(output.url),
  } as FetchOutput;
}
