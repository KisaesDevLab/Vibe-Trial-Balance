"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpRouter = void 0;
/**
 * HTTP/SSE transport for MCP.
 * Mounts at:
 *   GET  /mcp/sse      — SSE endpoint (client connects here)
 *   POST /mcp/messages — message endpoint (client sends JSON-RPC here)
 */
const express_1 = require("express");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const server_1 = require("../mcp/server");
const auth_1 = require("../mcp/auth");
exports.mcpRouter = (0, express_1.Router)();
// Store active SSE transports keyed by session ID
const activeTransports = new Map();
// GET /mcp/sse — SSE connection endpoint (requires MCP token)
exports.mcpRouter.get('/sse', auth_1.mcpAuthMiddleware, (req, res) => {
    const transport = new sse_js_1.SSEServerTransport('/mcp/messages', res);
    const sessionId = transport.sessionId;
    activeTransports.set(sessionId, transport);
    res.on('close', () => {
        activeTransports.delete(sessionId);
    });
    const server = (0, server_1.createMcpServer)();
    server.connect(transport).catch((err) => {
        console.error('MCP SSE connect error:', err);
        activeTransports.delete(sessionId);
    });
});
// POST /mcp/messages — message endpoint (requires MCP token)
exports.mcpRouter.post('/messages', auth_1.mcpAuthMiddleware, async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        res.status(400).json({ error: 'Missing sessionId query parameter' });
        return;
    }
    const transport = activeTransports.get(sessionId);
    if (!transport) {
        res.status(404).json({ error: `No active SSE session for sessionId: ${sessionId}` });
        return;
    }
    try {
        await transport.handlePostMessage(req, res);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
//# sourceMappingURL=mcpHttp.js.map