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
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ err: error }, 'MCP request failed');
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
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
