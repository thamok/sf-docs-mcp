export type JsonSchema = Record<string, unknown>;

export const TrackingQueryParams = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
]);

export function canonicalizeUrl(input: string): string {
  const url = new URL(input);

  // Canonical host/protocol/path conventions.
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  // Drop known tracking params and normalize ordering for deterministic citations.
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TrackingQueryParams.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  url.search = '';
  for (const [key, value] of params) {
    url.searchParams.append(key, value);
  }

  // Remove duplicate trailing slash while preserving root path.
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}

export function assertObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

export function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
}

export function assertOptionalString(value: unknown, field: string): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    throw new Error(`${field} must be a non-empty string when provided`);
  }
}

export function assertOptionalStringArray(
  value: unknown,
  field: string,
): asserts value is string[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
    throw new Error(`${field} must be an array of non-empty strings when provided`);
  }
}

export function assertNumberInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
    throw new Error(`${field} must be a number in [${min}, ${max}]`);
  }
}

export function assertOptionalNumberInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
): asserts value is number | undefined {
  if (value === undefined) return;
  assertNumberInRange(value, field, min, max);
}
