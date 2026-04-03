import {
  SearchInput,
  SearchOutput,
  searchInputSchema,
  searchOutputSchema,
  validateSearchInput,
  validateSearchOutput,
} from '../../../../../packages/shared/schemas/search';

export interface SearchBackend {
  searchDocs(input: SearchInput): Promise<SearchOutput>;
}

export const searchTool = {
  name: 'search',
  description: 'Search documentation with optional product and section filters.',
  inputSchema: searchInputSchema,
  outputSchema: searchOutputSchema,
  async run(rawInput: unknown, backend: SearchBackend): Promise<SearchOutput> {
    const input = validateSearchInput(rawInput);
    const rawOutput = await backend.searchDocs(input);
    return validateSearchOutput(rawOutput);
  },
};
