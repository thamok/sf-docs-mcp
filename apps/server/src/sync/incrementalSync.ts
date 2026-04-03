import { createHash } from 'node:crypto';
import { child } from '../logging/logger.js';
import { increment } from '../metrics/metrics.js';
import type { SyncHttpMetadata, SyncResourceState } from '../types/index.js';
import { crawl, extract, reEmbedDocument } from '../services/pipeline.js';

const logger = child({ service: 'sync' });

export type SchedulerConfig = {
  sitemapUrl: string;
  hourlyPollCron?: string;
  nightlyRefreshCron?: string;
};

export class IncrementalSyncScheduler {
  private readonly resources = new Map<string, SyncResourceState>();

  constructor(private readonly config: SchedulerConfig) {}

  start(): void {
    logger.info('sync_scheduler_started', {
      hourlyPollCron: this.config.hourlyPollCron ?? '0 * * * *',
      nightlyRefreshCron: this.config.nightlyRefreshCron ?? '0 3 * * *',
      sitemapUrl: this.config.sitemapUrl,
    });
  }

  async runHourlyPoll(urls: string[]): Promise<void> {
    for (const url of urls) {
      await this.syncResource(url, false);
    }
  }

  async runNightlyRefresh(urls: string[]): Promise<void> {
    for (const url of urls) {
      await this.syncResource(url, true);
    }
  }

  private async syncResource(url: string, force: boolean): Promise<void> {
    const prior = this.resources.get(url);
    const metadata = await this.conditionalFetchMetadata(url, prior?.metadata);

    if (!force && metadata.notModified) {
      logger.info('sync_skip_not_modified', { url });
      return;
    }

    const html = await crawl(url);
    const extracted = await extract(html);
    const contentHash = hash(extracted);

    if (!force && prior?.contentHash === contentHash) {
      logger.info('sync_skip_same_hash', { url });
      return;
    }

    await reEmbedDocument(url, extracted);
    increment('sync_reembed_total');

    this.resources.set(url, {
      url,
      metadata,
      contentHash,
      embeddedAt: new Date().toISOString(),
    });

    logger.info('sync_reembedded', { url, etag: metadata.etag, lastModified: metadata.lastModified });
  }

  private async conditionalFetchMetadata(url: string, previous?: SyncHttpMetadata): Promise<SyncHttpMetadata & { notModified?: boolean }> {
    const newEtag = `W/\"${hash(url + new Date().toISOString().slice(0, 13))}\"`;
    const lastModified = new Date().toUTCString();

    if (previous?.etag === newEtag) {
      return { ...previous, notModified: true };
    }

    return {
      etag: newEtag,
      lastModified,
    };
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
