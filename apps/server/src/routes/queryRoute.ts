import type { Express, Request, Response } from 'express';
import { runSearchQuery } from '../services/pipeline.js';

export function registerQueryRoute(app: Express): void {
  app.get('/query', async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'Missing query parameter q.' });
      return;
    }

    const results = await runSearchQuery(q);
    res.json({ query: q, results });
  });
}
