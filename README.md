# Desearch Web Search for OpenClaw

Use Desearch as OpenClaw's `web_search` provider. This plugin forwards searches to the existing [Desearch MCP service](https://github.com/Desearch-ai/mcp-desearch) at `https://mcp.desearch.ai/mcp`. It returns page titles, links, and snippets.

## Requirements

- OpenClaw **2026.11.10**. The experimental provider SDK is pinned to this tested release.
- Node **24.22.1+** on the 24.x line, or **26.12.1+**.
- A [Desearch API key](https://console.desearch.ai/api-keys) and an available Desearch balance. Usage is billed by Desearch; see [current pricing](https://desearch.ai/pricing).

## Install

After the package is published, install the exact version from either registry:

```sh
openclaw plugins install npm:@desearch/openclaw-plugin@0.1.0
```

```sh
openclaw plugins install clawhub:@desearch/openclaw-plugin@0.1.0
```

For a local reviewed tarball:

```sh
openclaw plugins install npm-pack:./desearch-openclaw-plugin-0.1.0.tgz --force
```

Enable the plugin and select the provider:

```sh
openclaw plugins enable desearch-web-search
openclaw config set tools.web.search.provider desearch
```

Set `DESEARCH_API_KEY` in the Gateway process environment using your secret manager, then restart the Gateway. Alternatively, use OpenClaw's masked Search settings to set `plugins.entries.desearch-web-search.config.webSearch.apiKey`. Do not put a real key in shell history, prompts, or source control.

```sh
openclaw gateway restart
openclaw plugins inspect desearch-web-search --runtime --json
```

Ask the agent to search the web, or call `web_search` with:

```json
{ "query": "OpenClaw plugin SDK documentation", "count": 3 }
```

`query` is required, 1 to 2000 characters. `count` is optional, 1 to 10, default 5. The count is an upper bound; fewer matches may be returned. Location, language, freshness, and domain filters are not supported by this adapter. Results are untrusted external content.

## Data and failure behavior

The plugin sends your query and API key only to `https://mcp.desearch.ai/mcp`, using the `x-api-key` header and the MCP `web-search` tool. It does not call other MCP tools, store keys, cache queries, or add automatic retries. Redirects are rejected. Each search has a 30-second deadline and respects caller cancellation.

Missing credentials return setup guidance. Authentication, balance, network, malformed upstream response, and cancellation failures return a fixed provider error without remote response bodies. Input errors are rejected before the network request. Review [Desearch's privacy policy](https://desearch.ai/privacy).

## Disable

```sh
openclaw plugins disable desearch-web-search
```

Select another configured search provider before the next search. Disabling this plugin stops its use; it does not change your Desearch account or stored key.

## Development and QA

Use the pinned host and a supported Node version. Install the host alongside the package:

```sh
npm ci --ignore-scripts --legacy-peer-deps
npm install --no-save --package-lock=false --ignore-scripts openclaw@2026.11.10
npm run lint
npm test
npm pack --pack-destination ../artifacts
```

With `DESEARCH_API_KEY` supplied by your secret manager:

```sh
npm run smoke
```

The smoke script runs the registered provider against the live MCP service, then verifies that a randomly generated invalid key fails without leaking into output. Tests cover registration, mapping, count bounds, input rejection, missing credentials, malformed and failed upstream replies, cancellation, stale callers, and credential configuration hooks.

Validate the package with ClawHub CLI 0.27.0 before publishing:

```sh
clawhub package validate .
clawhub package publish ../artifacts/desearch-openclaw-plugin-0.1.0.tgz --family code-plugin --owner desearch --dry-run
```

The dry run creates no release. Publication requires an authorized `desearch` publisher matching the package scope, source repository and commit metadata, and review of the exact package.

SDK and registry references: [building plugins](https://docs.openclaw.ai/plugins/building-plugins), [provider media and search](https://docs.openclaw.ai/plugins/sdk-provider-plugins/media-and-search), [package metadata](https://docs.openclaw.ai/plugins/sdk-setup), [ClawHub publishing](https://docs.openclaw.ai/clawhub/publishing).
