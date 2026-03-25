import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-12345';

export interface McpRequest extends Request {
  mcpUserId?: number;
}

/** Validates Bearer MCP token from Authorization header. Sets req.mcpUserId if valid. */
export async function mcpAuthMiddleware(
  req: McpRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const row = await db('settings').where({ key: 'mcp_token' }).first('value');
    if (!row || !row.value || row.value !== token) {
      res.status(401).json({ error: 'Invalid MCP token' });
      return;
    }

    // Look up mcp_agent user ID dynamically
    const agentUser = await db('app_users').where({ username: 'mcp_agent' }).first('id');
    if (agentUser) {
      req.mcpUserId = agentUser.id as number;
    }

    next();
  } catch {
    res.status(500).json({ error: 'Authentication error' });
  }
}

/** Get the mcp_agent user ID, creating it if needed */
export async function getMcpAgentUserId(): Promise<number> {
  const agentUser = await db('app_users').where({ username: 'mcp_agent' }).first('id');
  if (agentUser) return agentUser.id as number;
  // Fallback: return 0 if user doesn't exist yet
  return 0;
}

/** Generate a short-lived JWT for the mcp_agent user (used to call JWT-protected internal routes) */
export async function generateMcpAgentJwt(): Promise<string | null> {
  const agentUser = await db('app_users')
    .where({ username: 'mcp_agent' })
    .first('id', 'username', 'role');
  if (!agentUser) return null;
  return jwt.sign(
    { userId: agentUser.id, username: agentUser.username, role: agentUser.role },
    JWT_SECRET,
    { expiresIn: '5m' } as jwt.SignOptions,
  );
}
