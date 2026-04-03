import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import { searchTool } from './mcp/tools/search.js';
import { fetchTool } from './mcp/tools/fetch.js';
import { getRelatedTool } from './mcp/tools/getRelated.js';
import { statsTool } from './mcp/tools/stats.js';
import { IndexRepository } from './services/indexRepository.js';

export const buildMcpServer = (config: AppConfig) => {
  const repo = new IndexRepository(config.indexPath);
  const server = new McpServer(
    {
      name: 'sf-docs-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        logging: {},
        tools: {},
      },
    },
  );

  server.registerTool(
    searchTool.name,
    {
      description: searchTool.description,
      inputSchema: {
        query: z.string().min(1),
        top_k: z.number().int().min(1).max(20).optional(),
        product_family: z.string().min(1).optional(),
        url_prefix: z.string().min(1).optional(),
        include_snippets: z.boolean().optional(),
      },
    },
    async (args: unknown) => {
      const output = await searchTool.run(args, repo);
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    fetchTool.name,
    {
      description: fetchTool.description,
      inputSchema: { id: z.string().min(1) },
    },
    async (args: unknown) => {
      const output = await fetchTool.run(args, repo);
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    getRelatedTool.name,
    {
      description: getRelatedTool.description,
      inputSchema: { id: z.string().min(1), top_k: z.number().int().min(1).max(20).optional() },
    },
    async (args: unknown) => {
      const output = await getRelatedTool.run(args, repo);
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    statsTool.name,
    {
      description: statsTool.description,
      inputSchema: { product_family: z.string().min(1).optional() },
    },
    async (args: unknown) => {
      const output = await statsTool.run(args, repo);

      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );

  return server;
};
