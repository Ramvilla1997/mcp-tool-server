import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ToolInputError } from './errors.js';
import { readSandboxFile, searchSandbox } from './sandbox.js';
import { computeTextStats } from './tools/textStats.js';
import { extractJsonPath } from './tools/jsonExtract.js';

export interface ServerConfig {
  sandboxRoot: string;
  maxFileBytes: number;
}

type ToolOutput = { content: { type: 'text'; text: string }[]; isError?: boolean };

function jsonResult(data: unknown): ToolOutput {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/**
 * Tool failures are returned as `isError` results, so the model can read the reason and
 * try again. Unexpected exceptions still propagate, so they are logged rather than hidden.
 */
async function runTool(action: () => Promise<unknown>): Promise<ToolOutput> {
  try {
    return jsonResult(await action());
  } catch (error) {
    if (error instanceof ToolInputError) {
      return { content: [{ type: 'text', text: error.message }], isError: true };
    }
    throw error;
  }
}

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({ name: 'mcp-tool-server', version: '1.0.0' });

  server.registerTool(
    'word_count',
    {
      title: 'Word count',
      description: 'Count words, sentences, and characters in a block of text and estimate reading time.',
      inputSchema: { text: z.string().max(100_000) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ text }) => runTool(async () => computeTextStats(text)),
  );

  server.registerTool(
    'json_extract',
    {
      title: 'Extract a JSON value',
      description: 'Read one value from a JSON document using a path such as orders[0].total.',
      inputSchema: {
        json: z.string().max(1_000_000),
        path: z.string().min(1).max(200),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ json, path }) => runTool(async () => ({ value: extractJsonPath(json, path) })),
  );

  server.registerTool(
    'read_file',
    {
      title: 'Read a sandboxed file',
      description: 'Read a UTF-8 text file from the sandbox directory. Paths outside the sandbox are refused.',
      inputSchema: { path: z.string().min(1).max(500) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ path }) =>
      runTool(() => readSandboxFile(config.sandboxRoot, path, config.maxFileBytes)),
  );

  server.registerTool(
    'search_text',
    {
      title: 'Search sandboxed files',
      description: 'Find lines containing a literal string in sandbox files. Returns file, line number, and text.',
      inputSchema: {
        query: z.string().min(2).max(200),
        maxResults: z.number().int().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query, maxResults }) =>
      runTool(() =>
        searchSandbox(config.sandboxRoot, query, { maxResults, maxFileBytes: config.maxFileBytes }),
      ),
  );

  return server;
}

