import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response, NextFunction } from 'express';
import { loadConfig } from './config.js';
import { createHttpLogger, createLogger } from './logger.js';
import { buildMcpServer } from './mcpServer.js';

export const createApp = () => {
  const config = loadConfig();
  const app = createMcpExpressApp({ host: config.host });
  const logger = createLogger(config.logLevel);

  app.use(createHttpLogger(config.logLevel));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');

    if (!origin) {
      return next();
    }

    if (config.corsAllowlist.length > 0 && !config.corsAllowlist.includes(origin)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }

    return next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!config.authToken) {
      return next();
    }

    const authHeader = req.header('authorization');
    if (authHeader !== `Bearer ${config.authToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const handleMcp = async (req: Request, res: Response) => {
    const server = buildMcpServer(config);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ err: error }, 'MCP request failed');

      if (!res.headersSent) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        const code = message.includes('Unknown document id') ? -32004 : -32603;

        res.status(code === -32004 ? 404 : 500).json({
          jsonrpc: '2.0',
          error: {
            code,
            message,
          },
          id: null,
        });
      }
    } finally {
      await transport.close();
      await server.close();
      logger.debug({ path: req.path }, 'Closed MCP request resources');
    }
  };

  app.get('/mcp', handleMcp);
  app.post('/mcp', handleMcp);

  return { app, config, logger };
};
