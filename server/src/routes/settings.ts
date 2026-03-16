import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

function maskKey(value: string): string {
  if (value.length <= 8) return '••••••••';
  return '••••••••' + value.slice(-4);
}

// GET /api/v1/settings
settingsRouter.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db('settings').select('key', 'value', 'updated_at');
    const result: Record<string, { masked: string | null; updated_at: string } | null> = {
      claude_api_key: null,
    };
    for (const row of rows) {
      if (row.key === 'claude_api_key') {
        result.claude_api_key = {
          masked: row.value ? maskKey(row.value as string) : null,
          updated_at: row.updated_at,
        };
      }
    }
    res.json({ data: result, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PUT /api/v1/settings
settingsRouter.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    claudeApiKey: z.string().min(1).max(200).optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  try {
    if (result.data.claudeApiKey !== undefined) {
      await db('settings')
        .insert({ key: 'claude_api_key', value: result.data.claudeApiKey, updated_at: db.fn.now() })
        .onConflict('key')
        .merge({ value: result.data.claudeApiKey, updated_at: db.fn.now() });
    }
    res.json({ data: { saved: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// DELETE /api/v1/settings/claude-api-key
settingsRouter.delete('/claude-api-key', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await db('settings').where({ key: 'claude_api_key' }).delete();
    res.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
