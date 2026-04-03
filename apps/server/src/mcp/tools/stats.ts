import {
  StatsInput,
  StatsOutput,
  statsInputSchema,
  statsOutputSchema,
  validateStatsInput,
  validateStatsOutput,
} from '../../../../../packages/shared/schemas/stats.js';

export interface StatsBackend {
  getStats(input: StatsInput): Promise<StatsOutput>;
}

export const statsTool = {
  name: 'stats',
  description: 'Return index-level statistics and crawl freshness metadata.',
  inputSchema: statsInputSchema,
  outputSchema: statsOutputSchema,
  async run(rawInput: unknown, backend: StatsBackend): Promise<StatsOutput> {
    const input = validateStatsInput(rawInput);
    const rawOutput = await backend.getStats(input);
    return validateStatsOutput(rawOutput);
  },
};
