export async function getRobotsTxt(robotsUrl, fetcher) {
  const response = await fetcher.fetch(robotsUrl);
  if (!response.ok) {
    throw new Error(`Failed to retrieve robots.txt from ${robotsUrl}: ${response.status}`);
  }

  return response.text();
}

export function discoverSitemapsFromRobots(robotsContents) {
  const sitemaps = [];

  for (const line of robotsContents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = /^sitemap:\s*(.+)$/i.exec(trimmed);
    if (match?.[1]) {
      sitemaps.push(match[1].trim());
    }
  }

  return sitemaps;
}
