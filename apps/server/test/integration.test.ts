import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const parseSseMessage = (responseText: string) => {
  const match = responseText.match(/data: (.+)\n/);
  if (!match) {
    throw new Error(`Unable to parse SSE payload: ${responseText}`);
  }

  return JSON.parse(match[1]) as Record<string, any>;
};

describe('MCP server integration', () => {
  it('lists tools through MCP endpoint', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      });

    const payload = parseSseMessage(response.text);

    expect(response.status).toBe(200);
    expect(payload.jsonrpc).toBe('2.0');
    expect(payload.result.tools.map((tool: { name: string }) => tool.name)).toEqual(
      expect.arrayContaining(['search', 'fetch', 'getRelated', 'stats']),
    );
  });

  it('search returns structured MCP data', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 'call-1',
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: {
            query: 'Tooling API authenticate',
            top_k: 2,
          },
        },
      });

    const payload = parseSseMessage(response.text);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      jsonrpc: '2.0',
      id: 'call-1',
    });
    expect(payload.result.structuredContent.results.length).toBeGreaterThan(0);
    expect(payload.result.structuredContent.results[0].url).toContain('developer.salesforce.com');
  });
});
