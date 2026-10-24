import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config/env.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = createServer({ sandboxRoot: config.SANDBOX_ROOT, maxFileBytes: config.MAX_FILE_BYTES });

await server.connect(new StdioServerTransport());

// stdout carries the protocol, so diagnostics must go to stderr.
console.error(`mcp-tool-server ready on stdio (sandbox: ${config.SANDBOX_ROOT})`);
