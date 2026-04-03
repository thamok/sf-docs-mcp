# Crawler

Crawler for Salesforce documentation discovery.

## Features

- Retrieves `robots.txt` from `https://developer.salesforce.com/robots.txt` and extracts sitemap declarations.
- Seeds crawl with:
  - `https://developer.salesforce.com/docs-atlas-sitemap.xml`
  - `https://developer.salesforce.com/docs/ssg-sitemap.xml`
- Recursively expands sitemap indexes to URL sets.
- Canonicalizes URLs by lowercasing host, stripping fragments, removing disallowed query params, and resolving redirects.
- Filters for official docs pages while excluding search/query variants.
- Uses polite crawling controls: bounded concurrency, per-host throttling, and retry with exponential backoff.

## Run

```bash
npm run crawl --prefix apps/crawler
```
