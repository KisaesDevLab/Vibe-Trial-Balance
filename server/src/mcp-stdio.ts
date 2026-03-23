/**
 * Standalone MCP stdio entrypoint.
 * Usage: node dist/mcp-stdio.js  (or tsx src/mcp-stdio.ts)
 * Used for Claude Desktop integration.
 */
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp/server';

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running — stdio transport keeps it alive
}

main().catch((err) => {
  console.error('MCP stdio server error:', err);
  process.exit(1);
});
