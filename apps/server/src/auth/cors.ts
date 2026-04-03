import type { NextFunction, Request, Response } from 'express';
import type { CorsConfig } from '../types/index.js';

export function strictCorsMiddleware(config: CorsConfig) {
  const allowed = new Set(config.allowedOrigins);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');

    if (!origin) {
      if (config.allowNullOrigin) {
        return next();
      }
      res.status(403).json({ error: 'Origin header required.' });
      return;
    }

    if (!allowed.has(origin)) {
      res.status(403).json({ error: `Origin not allowed: ${origin}` });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
