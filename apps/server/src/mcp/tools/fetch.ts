import {
  FetchInput,
  FetchOutput,
  fetchInputSchema,
  fetchOutputSchema,
  validateFetchInput,
  validateFetchOutput,
} from '../../../../../packages/shared/schemas/fetch';

export interface FetchBackend {
  fetchById(input: FetchInput): Promise<FetchOutput>;
}

export const fetchTool = {
  name: 'fetch',
  description: 'Fetch full canonical document payload by document id.',
  inputSchema: fetchInputSchema,
  outputSchema: fetchOutputSchema,
  async run(rawInput: unknown, backend: FetchBackend): Promise<FetchOutput> {
    const input = validateFetchInput(rawInput);
    const rawOutput = await backend.fetchById(input);
    return validateFetchOutput(rawOutput);
  },
};
