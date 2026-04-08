// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Router, Response, NextFunction } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendServerError } from '../lib/safeError';

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

  const { entity_type, action, from, to, client_id } = req.query as Record<string, string | undefined>;

  try {
    let query = db('audit_log')
      .leftJoin('app_users', 'app_users.id', 'audit_log.user_id')
      .leftJoin('clients', 'clients.id', 'audit_log.client_id')
      .select(
        'audit_log.id',
        'audit_log.user_id',
        'audit_log.entity_type',
        'audit_log.entity_id',
        'audit_log.action',
        'audit_log.description',
        'audit_log.period_id',
        'audit_log.client_id',
        'audit_log.created_at',
        'app_users.display_name as username',
        'clients.name as client_name',
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
    if (client_id) {
      const cid = Number(client_id);
      if (!isNaN(cid)) {
        query = query.where('audit_log.client_id', cid);
        countQuery = countQuery.where('client_id', cid);
      }
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
    sendServerError(res, err, 'audit-log');
  }
});
