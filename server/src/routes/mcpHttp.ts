/**
 * HTTP/SSE transport for MCP.
 * Mounts at:
 *   GET  /mcp/sse      — SSE endpoint (client connects here)
 *   POST /mcp/messages — message endpoint (client sends JSON-RPC here)
 */
import { Router, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from '../mcp/server';
import { mcpAuthMiddleware } from '../mcp/auth';

export const mcpRouter = Router();

// Store active SSE transports keyed by session ID
const activeTransports = new Map<string, SSEServerTransport>();

// GET /mcp/sse — SSE connection endpoint (requires MCP token)
mcpRouter.get('/sse', mcpAuthMiddleware, (req: Request, res: Response) => {
  const transport = new SSEServerTransport('/mcp/messages', res);
  const sessionId = transport.sessionId;
  activeTransports.set(sessionId, transport);

  res.on('close', () => {
    activeTransports.delete(sessionId);
  });

  const server = createMcpServer();
  server.connect(transport).catch((err: unknown) => {
    console.error('MCP SSE connect error:', err);
    activeTransports.delete(sessionId);
  });
});

// POST /mcp/messages — message endpoint (requires MCP token)
mcpRouter.post('/messages', mcpAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.query.sessionId as string;
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
