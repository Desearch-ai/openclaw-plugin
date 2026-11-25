import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { search, parseResults } from '../dist/search.js';
import plugin, { createDesearchProvider } from '../dist/index.js';
const reply = data => ({ content: [{ type: 'text', text: JSON.stringify({ data }) }] });

test('registers the declared native web_search provider', () => {
  let registered;
  plugin.register({ registerWebSearchProvider(value) { registered = value; } });
  assert.equal(registered.id, 'desearch');
  assert.equal(registered.createTool({}).annotations.readOnlyHint, true);
});
test('maps MCP web results, filters invalid URLs, and limits count', async () => {
  const output = await search({ query: ' example ', count: 1 }, 'test', undefined, async query => {
    assert.equal(query, 'example');
    return reply([{ title: 'Bad', link: 'javascript:bad()' }, { title: 'Example', link: 'https://example.com', snippet: 'Text' }, { title: 'Other', link: 'https://example.org' }]);
  });
  assert.equal(output.kind, 'results');
  assert.equal(output.count, 1);
  assert.equal(output.results[0].url, 'https://example.com');
  assert.equal(output.externalContent.untrusted, true);
});
test('supports empty results without inventing matches', () => assert.deepEqual(parseResults(reply([]), 5), []));
test('rejects invalid input before calling MCP', async () => {
  for (const args of [{ query: '' }, { query: ' ' }, { query: 'x'.repeat(2001) }, { query: 'ok', count: 0 }, { query: 'ok', count: 11 }, { query: 'ok', count: 1.5 }, { query: 'ok', country: 'DE' }]) {
    await assert.rejects(search(args, 'test', undefined, async () => assert.fail('must not call')));
  }
});
test('missing credentials do not make a request', async () => {
  const output = await search({ query: 'example' }, undefined, undefined, async () => assert.fail('must not call'));
  assert.equal(output.kind, 'error');
});
test('redacts transport, auth and MCP error paths with an in-memory canary', async () => {
  const canary = randomBytes(32).toString('hex');
  const failures = [async () => { throw new Error(`Authorization ${canary}`); }, async () => ({ isError: true, content: [{ type: 'text', text: canary }] }), async () => ({ content: [{ type: 'text', text: canary }] })];
  for (const call of failures) {
    const output = await search({ query: 'example' }, canary, undefined, call);
    assert.equal(output.kind, 'error');
    assert.ok(!JSON.stringify(output).includes(canary));
  }
});
test('cancellation and stale callers never start a request', async () => {
  for (const context of [{ signal: AbortSignal.abort() }, { assertCurrent() { throw new Error('stale'); } }]) {
    const output = await search({ query: 'example' }, 'test', context, async () => assert.fail('must not call'));
    assert.equal(output.kind, 'error');
  }
});
test('passes a bounded abort signal and cancels a completed stale request', async () => {
  const controller = new AbortController();
  const output = await search({ query: 'example' }, 'test', { signal: controller.signal }, async (_q, _k, signal) => {
    assert.ok(signal instanceof AbortSignal);
    controller.abort();
    return reply([]);
  });
  assert.equal(output.kind, 'error');
});
test('credential hooks round-trip their documented config paths', () => {
  const provider = createDesearchProvider();
  const config = {};
  provider.setConfiguredCredentialValue(config, 'test');
  assert.equal(provider.getConfiguredCredentialValue(config), 'test');
  const searchConfig = {};
  provider.setCredentialValue(searchConfig, 'test');
  assert.equal(provider.getCredentialValue(searchConfig), 'test');
});
