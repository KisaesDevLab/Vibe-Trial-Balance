"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Standalone MCP stdio entrypoint.
 * Usage: node dist/mcp-stdio.js  (or tsx src/mcp-stdio.ts)
 * Used for Claude Desktop integration.
 */
require("dotenv/config");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const server_1 = require("./mcp/server");
async function main() {
    const server = (0, server_1.createMcpServer)();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    // Server is now running — stdio transport keeps it alive
}
main().catch((err) => {
    console.error('MCP stdio server error:', err);
    process.exit(1);
});
//# sourceMappingURL=mcp-stdio.js.map