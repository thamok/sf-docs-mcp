import type { NextFunction, Request, Response } from 'express';
import type { HostedAuthConfig } from '../types/index.js';

export function bearerAuthMiddleware(config: HostedAuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.hostedMode) {
      return next();
    }

    const expected = config.bearerToken;
    if (!expected) {
      res.status(500).json({ error: 'Hosted mode is enabled but BEARER_TOKEN is not configured.' });
      return;
    }

    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing bearer token.' });
      return;
    }

    const providedToken = header.slice('Bearer '.length).trim();
    if (providedToken.length === 0 || providedToken !== expected) {
      res.status(403).json({ error: 'Invalid bearer token.' });
      return;
    }

    next();
  };
}
