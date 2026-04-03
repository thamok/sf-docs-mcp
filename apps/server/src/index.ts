import express from 'express';
import { bearerAuthMiddleware } from './auth/bearerAuth.js';
import { strictCorsMiddleware } from './auth/cors.js';
import { child } from './logging/logger.js';
import { snapshotAndReset } from './metrics/metrics.js';
import { registerQueryRoute } from './routes/queryRoute.js';
import { IncrementalSyncScheduler } from './sync/incrementalSync.js';

const logger = child({ service: 'server' });
const app = express();
app.use(express.json());

app.use(
  strictCorsMiddleware({
    allowedOrigins: splitCsv(process.env.ALLOWED_ORIGINS),
    allowNullOrigin: false,
  }),
);

app.use(
  bearerAuthMiddleware({
    hostedMode: process.env.HOSTED_MODE === 'true',
    bearerToken: process.env.BEARER_TOKEN,
  }),
);

registerQueryRoute(app);

app.get('/metrics', (_req, res) => {
  res.json({ samples: snapshotAndReset() });
});

const port = Number(process.env.PORT ?? 3000);
const scheduler = new IncrementalSyncScheduler({ sitemapUrl: process.env.SITEMAP_URL ?? 'https://example.com/sitemap.xml' });
scheduler.start();
void scheduler.runHourlyPoll(['https://example.com/doc1', 'https://example.com/doc2']);

app.listen(port, () => {
  logger.info('server_started', { port });
});

function splitCsv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}
