import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'http';

export const createLogger = (level: string) => pino({ level });

export const createHttpLogger = (level: string) =>
  pinoHttp({
    level,
    genReqId: (req: IncomingMessage) => req.headers['x-request-id']?.toString() ?? crypto.randomUUID(),
    serializers: {
      req: (req: IncomingMessage & { id?: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode
      })
    }
  });
