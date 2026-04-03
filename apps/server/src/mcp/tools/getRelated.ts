import {
  GetRelatedInput,
  GetRelatedOutput,
  getRelatedInputSchema,
  getRelatedOutputSchema,
  validateGetRelatedInput,
  validateGetRelatedOutput,
} from '../../../../../packages/shared/schemas/getRelated.js';

export interface GetRelatedBackend {
  getRelated(input: GetRelatedInput): Promise<GetRelatedOutput>;
}

export const getRelatedTool = {
  name: 'getRelated',
  description: 'Return similar/related documents for a given document id.',
  inputSchema: getRelatedInputSchema,
  outputSchema: getRelatedOutputSchema,
  async run(rawInput: unknown, backend: GetRelatedBackend): Promise<GetRelatedOutput> {
    const input = validateGetRelatedInput(rawInput);
    const rawOutput = await backend.getRelated(input);
    return validateGetRelatedOutput(rawOutput);
  },
};
