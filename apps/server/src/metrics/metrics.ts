export type MetricSample = {
  name: string;
  value: number;
  tags?: Record<string, string>;
  unit?: 'ms' | 'count';
};

const samples: MetricSample[] = [];

export function observe(metric: MetricSample): void {
  samples.push(metric);
}

export function increment(name: string, tags?: Record<string, string>): void {
  observe({ name, value: 1, unit: 'count', tags });
}

export function snapshotAndReset(): MetricSample[] {
  const snap = [...samples];
  samples.length = 0;
  return snap;
}

export async function measureLatency<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    observe({ name, unit: 'ms', value: Date.now() - start, tags: { ...tags, outcome: 'ok' } });
    return result;
  } catch (error) {
    observe({ name, unit: 'ms', value: Date.now() - start, tags: { ...tags, outcome: 'error' } });
    throw error;
  }
}
