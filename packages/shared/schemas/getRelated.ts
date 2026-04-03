import { assertNumberInRange, assertObject, assertString, canonicalizeUrl, JsonSchema } from './common';

export interface GetRelatedInput {
  id: string;
  top_k?: number;
}

export interface GetRelatedOutput {
  related: Array<{
    id: string;
    title: string;
    url: string;
    score: number;
  }>;
}

export const getRelatedInputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 },
    top_k: { type: 'integer', minimum: 1, maximum: 20 },
  },
};

export const getRelatedOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['related'],
  properties: {
    related: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'url', 'score'],
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          url: { type: 'string', format: 'uri' },
          score: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

export function validateGetRelatedInput(input: unknown): GetRelatedInput {
  assertObject(input, 'getRelated input');
  assertString(input.id, 'id');
  if (input.top_k !== undefined) {
    assertNumberInRange(input.top_k, 'top_k', 1, 20);
  }
  return input as unknown as GetRelatedInput;
}

export function validateGetRelatedOutput(output: unknown): GetRelatedOutput {
  assertObject(output, 'getRelated output');
  if (!Array.isArray(output.related)) {
    throw new Error('related must be an array');
  }

  return {
    related: output.related.map((item, idx) => {
      assertObject(item, `related[${idx}]`);
      assertString(item.id, `related[${idx}].id`);
      assertString(item.title, `related[${idx}].title`);
      assertString(item.url, `related[${idx}].url`);
      assertNumberInRange(item.score, `related[${idx}].score`, 0, 1);

      return { ...(item as any), url: canonicalizeUrl(item.url) };
    }),
  };
}
