function decodeXmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function extractLocTags(xml) {
  const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
  const urls = [];
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(decodeXmlEntities(match[1].trim()));
  }

  return urls;
}

export async function parseSitemapDocument(sitemapUrl, fetcher) {
  const response = await fetcher.fetch(sitemapUrl);

  if (!response.ok) {
    throw new Error(`Failed to retrieve sitemap ${sitemapUrl}: ${response.status}`);
  }

  const xml = await response.text();

  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const isUrlSet = /<urlset[\s>]/i.test(xml);
  const locs = extractLocTags(xml);

  return {
    type: isIndex && !isUrlSet ? 'index' : 'urlset',
    locs
  };
}

export async function expandSitemapsRecursively(initialSitemaps, fetcher) {
  const queue = [...initialSitemaps];
  const visited = new Set();
  const pageUrls = new Set();

  while (queue.length > 0) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) {
      continue;
    }
    visited.add(sitemapUrl);

    const parsed = await parseSitemapDocument(sitemapUrl, fetcher);

    if (parsed.type === 'index') {
      for (const nested of parsed.locs) {
        if (!visited.has(nested)) {
          queue.push(nested);
        }
      }
    } else {
      for (const pageUrl of parsed.locs) {
        pageUrls.add(pageUrl);
      }
    }
  }

  return {
    visitedSitemaps: [...visited],
    pageUrls: [...pageUrls]
  };
}
