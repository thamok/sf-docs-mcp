const DEFAULT_RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Semaphore {
  constructor(size) {
    this.size = size;
    this.active = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.active < this.size) {
      this.active += 1;
      return;
    }

    await new Promise((resolve) => this.queue.push(resolve));
    this.active += 1;
  }

  release() {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

export class PoliteFetcher {
  constructor({
    concurrency = 8,
    perHostDelayMs = 500,
    maxRetries = 4,
    backoffBaseMs = 400,
    retryStatus = DEFAULT_RETRY_STATUS,
    userAgent = 'sf-docs-mcp-crawler/0.1'
  } = {}) {
    this.semaphore = new Semaphore(concurrency);
    this.perHostDelayMs = perHostDelayMs;
    this.maxRetries = maxRetries;
    this.backoffBaseMs = backoffBaseMs;
    this.retryStatus = retryStatus;
    this.userAgent = userAgent;
    this.lastRequestByHost = new Map();
  }

  async #respectHostThrottle(hostname) {
    const previous = this.lastRequestByHost.get(hostname) ?? 0;
    const elapsed = Date.now() - previous;
    if (elapsed < this.perHostDelayMs) {
      await sleep(this.perHostDelayMs - elapsed);
    }
    this.lastRequestByHost.set(hostname, Date.now());
  }

  async fetch(url, options = {}) {
    return this.semaphoreWrappedFetch(url, options);
  }

  async semaphoreWrappedFetch(url, options) {
    await this.semaphore.acquire();

    try {
      const parsed = new URL(url);
      await this.#respectHostThrottle(parsed.hostname);

      let attempt = 0;
      while (true) {
        try {
          const response = await fetch(parsed, {
            redirect: 'follow',
            ...options,
            headers: {
              'user-agent': this.userAgent,
              ...(options.headers ?? {})
            }
          });

          if (this.retryStatus.has(response.status) && attempt < this.maxRetries) {
            const delay = this.backoffBaseMs * 2 ** attempt;
            await sleep(delay);
            attempt += 1;
            continue;
          }

          return response;
        } catch (error) {
          if (attempt >= this.maxRetries) {
            throw error;
          }

          const delay = this.backoffBaseMs * 2 ** attempt;
          await sleep(delay);
          attempt += 1;
        }
      }
    } finally {
      this.semaphore.release();
    }
  }
}
