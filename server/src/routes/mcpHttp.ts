// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * HTTP/SSE transport for MCP.
 * Mounts at:
 *   GET  /mcp/sse      — SSE endpoint (client connects here)
 *   POST /mcp/messages — message endpoint (client sends JSON-RPC here)
 */
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from '../mcp/server';
import { mcpAuthMiddleware, McpRequest } from '../mcp/auth';
import { sendServerError } from '../lib/safeError';

export const mcpRouter = Router();

// Front-door HTTP rate limit BEFORE auth so unauthenticated floods can't pin
// the CPU on bcrypt.compare for each request. After auth, the per-token
// bucket inside createMcpServer still applies.
const mcpHttpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'MCP HTTP rate limit exceeded.' },
});
mcpRouter.use(mcpHttpLimiter);

// Store active SSE transports keyed by session ID, tied to the token
// fingerprint. A /messages POST from a different token cannot reuse
// someone else's session (otherwise N tokens sharing one fingerprint-less
// map would be cross-tenant-addressable).
interface ActiveTransport { transport: SSEServerTransport; fingerprint: string }
const activeTransports = new Map<string, ActiveTransport>();

// GET /mcp/sse — SSE connection endpoint (requires MCP token)
mcpRouter.get('/sse', mcpAuthMiddleware, (req: McpRequest, res: Response) => {
  const transport = new SSEServerTransport('/mcp/messages', res);
  const sessionId = transport.sessionId;
  const fp = req.mcpTokenFingerprint ?? 'unknown';
  activeTransports.set(sessionId, { transport, fingerprint: fp });

  res.on('close', () => {
    activeTransports.delete(sessionId);
  });

  const server = createMcpServer(fp);
  server.connect(transport).catch((err: unknown) => {
    console.error('MCP SSE connect error:', err);
    activeTransports.delete(sessionId);
  });
});

// POST /mcp/messages — message endpoint (requires MCP token)
mcpRouter.post('/messages', mcpAuthMiddleware, async (req: McpRequest, res: Response): Promise<void> => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const entry = activeTransports.get(sessionId);
  if (!entry) {
    res.status(404).json({ error: `No active SSE session for sessionId: ${sessionId}` });
    return;
  }

  // A sessionId leaked between tokens does not grant access to that session.
  if (entry.fingerprint !== (req.mcpTokenFingerprint ?? 'unknown')) {
    res.status(403).json({ error: 'Session token mismatch' });
    return;
  }

  try {
    await entry.transport.handlePostMessage(req, res);
  } catch (err: unknown) {
    sendServerError(res, err, 'mcp-http');
  }
});
