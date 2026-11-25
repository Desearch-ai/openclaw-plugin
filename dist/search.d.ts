export declare const MCP_URL = "https://mcp.desearch.ai/mcp";
export type SearchResult = {
    title: string;
    url: string;
    snippet?: string;
};
export type McpReply = {
    isError?: boolean;
    content?: Array<{
        type: string;
        text?: string;
    }>;
};
export declare function callWebSearch(query: string, apiKey: string, signal: AbortSignal): Promise<McpReply>;
export declare function parseResults(reply: McpReply, count: number): SearchResult[];
export declare function search(args: Record<string, unknown>, apiKey: string | undefined, context?: {
    signal?: AbortSignal;
    assertCurrent?: () => void;
}, call?: typeof callWebSearch): Promise<Record<string, unknown>>;
