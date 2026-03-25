import { Router, Response, NextFunction } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const auditLogRouter = Router();
auditLogRouter.use(authMiddleware);

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
    return;
  }
  next();
}

// GET /api/v1/audit-log?page=1&limit=50&entity_type=&action=&from=&to=
auditLogRouter.get('/', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
  const offset = (page - 1) * limit;

  const { entity_type, action, from, to } = req.query as Record<string, string | undefined>;

  try {
    let query = db('audit_log')
      .leftJoin('app_users', 'app_users.id', 'audit_log.user_id')
      .select(
        'audit_log.id',
        'audit_log.user_id',
        'audit_log.entity_type',
        'audit_log.entity_id',
        'audit_log.action',
        'audit_log.description',
        'audit_log.period_id',
        'audit_log.created_at',
        'app_users.display_name as username',
      )
      .orderBy('audit_log.created_at', 'desc');

    let countQuery = db('audit_log').count('* as count');

    if (entity_type) {
      query = query.where('audit_log.entity_type', entity_type);
      countQuery = countQuery.where('entity_type', entity_type);
    }
    if (action) {
      query = query.where('audit_log.action', 'ilike', `%${action}%`);
      countQuery = countQuery.where('action', 'ilike', `%${action}%`);
    }
    if (from) {
      query = query.where('audit_log.created_at', '>=', from);
      countQuery = countQuery.where('created_at', '>=', from);
    }
    if (to) {
      query = query.where('audit_log.created_at', '<=', to);
      countQuery = countQuery.where('created_at', '<=', to);
    }

    const [rows, [{ count }]] = await Promise.all([
      query.limit(limit).offset(offset),
      countQuery,
    ]);

    res.json({
      data: rows,
      error: null,
      meta: { total: Number(count), page, limit },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
