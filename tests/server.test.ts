import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

let client: Client;

beforeAll(async () => {
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), 'mcp-server-'));
  await writeFile(path.join(sandboxRoot, 'notes.md'), 'alpha\nbeta release\n');

  const server = createServer({ sandboxRoot, maxFileBytes: 4096 });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
});

function textOf(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content[0]?.text ?? '';
}

describe('MCP server over the protocol', () => {
  it('advertises the four tools with input schemas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['json_extract', 'read_file', 'search_text', 'word_count']);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('runs word_count and returns structured JSON text', async () => {
    const result = await client.callTool({ name: 'word_count', arguments: { text: 'hello there world' } });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toMatchObject({ words: 3 });
  });

  it('returns a readable tool error for a sandbox escape instead of crashing', async () => {
    const result = await client.callTool({ name: 'read_file', arguments: { path: '../../../etc/passwd' } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/outside the sandbox|No file or directory/);
  });

  it('rejects arguments that fail the schema before the tool runs', async () => {
    const result = await client.callTool({ name: 'search_text', arguments: { query: 'x', maxResults: 9999 } });
    expect(result.isError).toBe(true);
  });

  it('finds sandboxed text with search_text', async () => {
    const result = await client.callTool({ name: 'search_text', arguments: { query: 'release' } });
    expect(JSON.parse(textOf(result)).matches).toEqual([{ file: 'notes.md', line: 2, text: 'beta release' }]);
  });
});
