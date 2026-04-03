import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AppConfig } from './config.js';

export const buildMcpServer = (config: AppConfig) => {
  const server = new McpServer(
    {
      name: 'sf-docs-mcp-server',
      version: '0.1.0'
    },
    {
      capabilities: {
        logging: {},
        tools: {}
      }
    }
  );

  server.registerTool(
    'search',
    {
      description: 'Search documents from the configured search service.',
      inputSchema: {
        query: z.string().min(1)
      }
    },
    async ({ query }) => ({
      content: [
        {
          type: 'text',
          text: `search stub: query="${query}" target="${config.searchServiceUrl}"`
        }
      ]
    })
  );

  server.registerTool(
    'fetch',
    {
      description: 'Fetch document content from the configured fetch service.',
      inputSchema: {
        url: z.string().url()
      }
    },
    async ({ url }) => ({
      content: [
        {
          type: 'text',
          text: `fetch stub: url="${url}" backend="${config.fetchServiceUrl}"`
        }
      ]
    })
  );

  return server;
};
