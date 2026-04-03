const DEFAULT_ALLOWED_QUERY_PARAMS = new Set();

export async function resolveFinalUrl(url, fetcher) {
  const response = await fetcher.fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    return url;
  }
  return response.url || url;
}

export function canonicalizeUrl(inputUrl, allowedQueryParams = DEFAULT_ALLOWED_QUERY_PARAMS) {
  const url = new URL(inputUrl);

  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  const originalParams = [...url.searchParams.entries()];
  url.search = '';

  for (const [key, value] of originalParams) {
    if (allowedQueryParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

const ALLOWED_DOC_PATTERNS = [
  /^\/docs(?:$|\/)/,
  /^\/docs-atlas(?:$|\/)/
];

const DENY_PATH_PATTERNS = [
  /\/search(?:$|\/)/i,
  /\/results(?:$|\/)/i
];

const DENY_QUERY_KEYS = new Set([
  'q',
  'query',
  'search',
  'keyword',
  'keywords',
  's',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term'
]);

export function isAllowedOfficialDocsPage(urlString) {
  const url = new URL(urlString);

  if (url.hostname !== 'developer.salesforce.com') {
    return false;
  }

  if (!ALLOWED_DOC_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return false;
  }

  if (DENY_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return false;
  }

  for (const key of url.searchParams.keys()) {
    if (DENY_QUERY_KEYS.has(key.toLowerCase())) {
      return false;
    }
  }

  return true;
}
