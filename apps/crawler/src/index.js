import { PoliteFetcher } from './fetch/politeFetcher.js';
import { getRobotsTxt, discoverSitemapsFromRobots } from './sitemap/robots.js';
import { expandSitemapsRecursively } from './sitemap/parser.js';
import { canonicalizeUrl, isAllowedOfficialDocsPage, resolveFinalUrl } from './normalize/canonicalize.js';

const ROBOTS_URL = 'https://developer.salesforce.com/robots.txt';
const SEED_SITEMAPS = [
  'https://developer.salesforce.com/docs-atlas-sitemap.xml',
  'https://developer.salesforce.com/docs/ssg-sitemap.xml'
];

export async function collectSalesforceDocsUrls({
  allowedQueryParams = [],
  concurrency = 8,
  perHostDelayMs = 500,
  maxRetries = 4,
  backoffBaseMs = 400
} = {}) {
  const fetcher = new PoliteFetcher({
    concurrency,
    perHostDelayMs,
    maxRetries,
    backoffBaseMs
  });

  const robotsBody = await getRobotsTxt(ROBOTS_URL, fetcher);
  const robotsDiscovered = discoverSitemapsFromRobots(robotsBody);

  const sitemapSet = new Set([...SEED_SITEMAPS, ...robotsDiscovered]);
  const { visitedSitemaps, pageUrls } = await expandSitemapsRecursively([...sitemapSet], fetcher);

  const allowlist = new Set(allowedQueryParams.map((x) => x.toLowerCase()));
  const results = new Set();

  for (const discoveredUrl of pageUrls) {
    const redirected = await resolveFinalUrl(discoveredUrl, fetcher);
    const canonical = canonicalizeUrl(redirected, allowlist);

    if (isAllowedOfficialDocsPage(canonical)) {
      results.add(canonical);
    }
  }

  return {
    robotsUrl: ROBOTS_URL,
    discoveredSitemaps: [...sitemapSet],
    visitedSitemaps,
    urls: [...results]
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectSalesforceDocsUrls()
    .then((data) => {
      console.log(JSON.stringify({
        robotsUrl: data.robotsUrl,
        discoveredSitemaps: data.discoveredSitemaps.length,
        visitedSitemaps: data.visitedSitemaps.length,
        urls: data.urls.length
      }, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
