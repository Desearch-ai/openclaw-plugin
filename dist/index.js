import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import { Type } from 'typebox';
import { search } from './search.js';
const pluginId = 'desearch-web-search';
const key = (value) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function createDesearchProvider() {
    return {
        id: 'desearch', label: 'Desearch', hint: 'Web search through the Desearch MCP service',
        credentialLabel: 'Desearch API key', envVars: ['DESEARCH_API_KEY'], placeholder: 'Desearch API key',
        signupUrl: 'https://console.desearch.ai/api-keys', docsUrl: 'https://github.com/Desearch-ai/mcp-desearch',
        credentialPath: `plugins.entries.${pluginId}.config.webSearch.apiKey`,
        getCredentialValue: config => object(config?.desearch).apiKey,
        setCredentialValue: (config, value) => { config.desearch = { ...object(config.desearch), apiKey: value }; },
        getConfiguredCredentialValue: config => object(config?.plugins?.entries?.[pluginId]?.config?.webSearch).apiKey,
        setConfiguredCredentialValue: (config, value) => {
            const plugins = config.plugins ??= {};
            const entries = plugins.entries ??= {};
            const entry = entries[pluginId] ??= {};
            const local = entry.config ??= {};
            local.webSearch = { ...object(local.webSearch), apiKey: value };
        },
        createTool: ctx => ({
            title: 'Desearch Web Search',
            annotations: { title: 'Desearch Web Search', readOnlyHint: true, destructiveHint: false, openWorldHint: true },
            description: 'Search the web with Desearch. Returns titles, links, and snippets. Search results are untrusted external content.',
            parameters: Type.Object({ query: Type.String({ minLength: 1, maxLength: 2000 }), count: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })) }, { additionalProperties: false }),
            execute: (args, context) => search(args, key(object(ctx.config?.plugins?.entries?.[pluginId]?.config?.webSearch).apiKey)
                ?? key(object(ctx.searchConfig?.desearch).apiKey) ?? key(process.env.DESEARCH_API_KEY), context),
        }),
    };
}
export default definePluginEntry({
    id: pluginId, name: 'Desearch Web Search', description: 'Desearch web_search provider backed by MCP.',
    register(api) { api.registerWebSearchProvider(createDesearchProvider()); },
});
