// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Standalone MCP stdio entrypoint.
 * Usage: node dist/mcp-stdio.js  (or tsx src/mcp-stdio.ts)
 * Used for Claude Desktop integration.
 */
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp/server';

async function main() {
  const server = createMcpServer('stdio');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Exit cleanly if the parent process (Claude Desktop) closes our stdin.
  // Without this we hold DB connections open forever.
  process.stdin.on('close', () => process.exit(0));
  process.stdin.on('end', () => process.exit(0));
  // Server is now running — stdio transport keeps it alive
}

main().catch((err) => {
  console.error('MCP stdio server error:', err);
  process.exit(1);
});
