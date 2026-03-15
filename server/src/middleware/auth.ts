import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-12345';

export interface AuthRequest extends Request {
  user?: { userId: number; username: string; role: string };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res
      .status(401)
      .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      username: string;
      role: string;
    };
    req.user = payload;
    next();
  } catch {
    res
      .status(401)
      .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}
