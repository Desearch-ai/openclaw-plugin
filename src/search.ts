import { wrapWebContent } from 'openclaw/plugin-sdk/security-runtime';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const MCP_URL = 'https://mcp.desearch.ai/mcp';
export type SearchResult = { title: string; url: string; snippet?: string };
export type McpReply = { isError?: boolean; content?: Array<{ type: string; text?: string }> };

// Only the public web-search MCP tool is exposed. Search logic stays on the server.
export async function callWebSearch(query: string, apiKey: string, signal: AbortSignal): Promise<McpReply> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { 'x-api-key': apiKey }, redirect: 'error' },
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 },
  });
  const client = new Client({ name: 'desearch-openclaw-plugin', version: '0.1.0' });
  try {
    await client.connect(transport, { signal, timeout: 30_000 });
    const reply = await client.callTool({ name: 'web-search', arguments: { query } }, undefined, { signal, timeout: 30_000 });
    if (!('content' in reply) || !Array.isArray(reply.content)) throw new Error('Missing MCP content');
    return { isError: reply.isError === true, content: reply.content.filter((item): item is { type: string; text?: string } => !!item && typeof item === 'object' && 'type' in item) };
  } finally {
    await client.close().catch(() => {});
  }
}

export function parseResults(reply: McpReply, count: number): SearchResult[] {
  if (reply.isError) throw new Error('MCP tool failed');
  const text = reply.content?.find(item => item.type === 'text')?.text;
  if (!text) throw new Error('Missing MCP content');
  const body: unknown = JSON.parse(text);
  const data = body && typeof body === 'object' && 'data' in body ? body.data : undefined;
  if (!Array.isArray(data)) throw new Error('Invalid MCP result');
  return data.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .flatMap(row => {
      const url = typeof row.link === 'string' ? row.link : row.url;
      if (typeof url !== 'string' || typeof row.title !== 'string') return [];
      try { if (!['https:', 'http:'].includes(new URL(url).protocol)) return []; } catch { return []; }
      return [{ title: row.title, url, ...(typeof row.snippet === 'string' ? { snippet: row.snippet } : {}) }];
    }).slice(0, count);
}

export async function search(
  args: Record<string, unknown>, apiKey: string | undefined,
  context?: { signal?: AbortSignal; assertCurrent?: () => void },
  call = callWebSearch,
): Promise<Record<string, unknown>> {
  if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 2000)
    throw new Error('query must contain 1 to 2000 characters.');
  const count = args.count ?? 5;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 10)
    throw new Error('count must be an integer from 1 to 10.');
  for (const key of Object.keys(args)) if (!['query', 'count'].includes(key)) throw new Error('Unsupported search parameter.');
  if (!apiKey?.trim()) return { kind: 'error', provider: 'desearch', error: 'provider_error', message: 'Set DESEARCH_API_KEY or the Desearch plugin webSearch.apiKey.' };
  try {
    context?.signal?.throwIfAborted();
    context?.assertCurrent?.();
    const signal = context?.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
    const reply = await call(args.query.trim(), apiKey, signal);
    context?.signal?.throwIfAborted();
    context?.assertCurrent?.();
    const results = parseResults(reply, count).map(row => ({ ...row, title: wrapWebContent(row.title, 'web_search'), ...(row.snippet === undefined ? {} : { snippet: wrapWebContent(row.snippet, 'web_search') }) }));
    return { kind: 'results', provider: 'desearch', query: args.query.trim(), count: results.length, results,
      externalContent: { untrusted: true, source: 'web_search', wrapped: true, provider: 'desearch' } };
  } catch {
    // Remote bodies and transport errors may include credentials. Never return them.
    return { kind: 'error', provider: 'desearch', error: 'provider_error', message: 'Desearch search failed. Check your API key, balance, connectivity, or cancellation and try again.' };
  }
}
