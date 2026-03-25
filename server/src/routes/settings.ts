import { Router, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getLLMProvider, DEFAULT_FAST_MODEL, DEFAULT_PRIMARY_MODEL } from '../lib/aiClient';
import { extractJsonObject } from '../lib/aiJsonExtract';

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
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
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
settingsRouter.delete('/claude-api-key', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  try {
    await db('settings').where({ key: 'claude_api_key' }).delete();
    res.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/settings/mcp-token
settingsRouter.get('/mcp-token', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const row = await db('settings').where({ key: 'mcp_token' }).first('value', 'updated_at');
    if (!row || !row.value) {
      res.json({ data: { configured: false, masked: null, updated_at: null }, error: null });
      return;
    }
    res.json({
      data: {
        configured: true,
        masked: maskKey(row.value as string),
        updated_at: row.updated_at,
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/settings/mcp-token/generate (admin only)
settingsRouter.post('/mcp-token/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  try {
    const token = randomBytes(32).toString('hex');
    await db('settings')
      .insert({ key: 'mcp_token', value: token, updated_at: db.fn.now() })
      .onConflict('key')
      .merge({ value: token, updated_at: db.fn.now() });
    res.json({
      data: {
        token, // Full token returned ONCE on generation
        masked: maskKey(token),
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// DELETE /api/v1/settings/mcp-token (admin only)
settingsRouter.delete('/mcp-token', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  try {
    await db('settings').where({ key: 'mcp_token' }).delete();
    res.json({ data: { revoked: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/settings/ai-pricing
settingsRouter.get('/ai-pricing', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const row = await db('settings').where({ key: 'ai_model_pricing' }).first('value');
    const pricing = row?.value ? JSON.parse(row.value as string) : {};
    res.json({ data: pricing, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PUT /api/v1/settings/ai-pricing (admin only)
settingsRouter.put('/ai-pricing', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  const schema = z.record(z.string(), z.object({
    input: z.number().min(0),
    output: z.number().min(0),
  }));
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  try {
    await db('settings')
      .insert({ key: 'ai_model_pricing', value: JSON.stringify(result.data), updated_at: db.fn.now() })
      .onConflict('key')
      .merge({ value: JSON.stringify(result.data), updated_at: db.fn.now() });
    res.json({ data: { saved: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/settings/ai-pricing/fetch — ask AI for current known pricing (admin only)
settingsRouter.post('/ai-pricing/fetch', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  try {
    const { provider, fastModel, primaryModel } = await getLLMProvider();
    const modelList = [fastModel, primaryModel].filter((v, i, a) => a.indexOf(v) === i); // dedupe
    const emptyStructure = modelList.map((m) => `"${m}":{"input":0.00,"output":0.00}`).join(',');
    const aiResult = await provider.complete({
      model: fastModel,
      maxTokens: 512,
      messages: [{
        role: 'user',
        content: `Return ONLY a valid JSON object (no prose, no markdown) with the current API pricing per million tokens for these models: ${modelList.join(' and ')}. Use this exact structure:
{${emptyStructure}}
Fill in the actual USD prices per million tokens from your most current knowledge. If you don't know the pricing for a model, use 0.00.`,
      }],
    });
    const pricing = extractJsonObject(aiResult.text);
    if (!pricing) {
      res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'AI returned unexpected format' } });
      return;
    }
    res.json({ data: pricing, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/settings/ai-usage — usage summary for current + prior month
settingsRouter.get('/ai-usage', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const summary = await db('ai_usage_log')
      .select(
        db.raw("to_char(date_trunc('month', created_at), 'YYYY-MM') as month"),
        'model',
        db.raw('COUNT(*) as calls'),
        db.raw('SUM(input_tokens) as input_tokens'),
        db.raw('SUM(output_tokens) as output_tokens'),
        db.raw('SUM(estimated_cost_usd) as estimated_cost_usd'),
      )
      .where('created_at', '>=', db.raw("date_trunc('month', NOW()) - interval '1 month'"))
      .groupByRaw("date_trunc('month', created_at), model")
      .orderByRaw("date_trunc('month', created_at) DESC, estimated_cost_usd DESC NULLS LAST");

    res.json({ data: summary, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/settings/ai-usage/detail — paginated per-call log (admin only)
settingsRouter.get('/ai-usage/detail', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
  const offset = (page - 1) * limit;

  const { endpoint, model, userId, from, to } = req.query as Record<string, string | undefined>;

  try {
    let query = db('ai_usage_log')
      .leftJoin('app_users', 'app_users.id', 'ai_usage_log.user_id')
      .leftJoin('clients', 'clients.id', 'ai_usage_log.client_id')
      .select(
        'ai_usage_log.id',
        'ai_usage_log.created_at',
        'ai_usage_log.endpoint',
        'ai_usage_log.model',
        'ai_usage_log.input_tokens',
        'ai_usage_log.output_tokens',
        'ai_usage_log.estimated_cost_usd',
        'ai_usage_log.user_id',
        'ai_usage_log.client_id',
        'app_users.display_name as username',
        'clients.name as client_name',
      )
      .orderBy('ai_usage_log.created_at', 'desc');

    let countQuery = db('ai_usage_log').count('* as count');

    const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');
    if (endpoint) { const ep = `%${escapeLike(endpoint)}%`; query = query.where('ai_usage_log.endpoint', 'ilike', ep); countQuery = countQuery.where('endpoint', 'ilike', ep); }
    if (model)    { const ml = `%${escapeLike(model)}%`;    query = query.where('ai_usage_log.model', 'ilike', ml);    countQuery = countQuery.where('model', 'ilike', ml); }
    if (userId)   { const uid = Number(userId); if (!isNaN(uid)) { query = query.where('ai_usage_log.user_id', uid); countQuery = countQuery.where('user_id', uid); } }
    if (from)     { query = query.where('ai_usage_log.created_at', '>=', from);              countQuery = countQuery.where('created_at', '>=', from); }
    if (to)       { query = query.where('ai_usage_log.created_at', '<=', to);                countQuery = countQuery.where('created_at', '<=', to); }

    const [rows, [{ count }]] = await Promise.all([
      query.limit(limit).offset(offset),
      countQuery,
    ]);

    res.json({ data: rows, error: null, meta: { total: Number(count), page, limit } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/settings/test-claude-key  (kept for backward compat — same as test-llm)
settingsRouter.post('/test-claude-key', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { provider, fastModel } = await getLLMProvider();
    await provider.healthCheck(fastModel);
    res.json({ data: { valid: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.json({ data: { valid: false, message }, error: null });
  }
});

// POST /api/v1/settings/test-llm  (provider-agnostic health check)
settingsRouter.post('/test-llm', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { provider, fastModel, providerName } = await getLLMProvider();
    await provider.healthCheck(fastModel);
    res.json({ data: { valid: true, provider: providerName }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.json({ data: { valid: false, message }, error: null });
  }
});

// GET /api/v1/settings/ai-models
settingsRouter.get('/ai-models', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await db('settings')
      .whereIn('key', ['ai_model_fast', 'ai_model_primary'])
      .select('key', 'value');
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key as string] = row.value as string;
    res.json({
      data: {
        fastModel:    map['ai_model_fast']    || DEFAULT_FAST_MODEL,
        primaryModel: map['ai_model_primary'] || DEFAULT_PRIMARY_MODEL,
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PUT /api/v1/settings/ai-models (admin only)
settingsRouter.put('/ai-models', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  const schema = z.object({
    fastModel:    z.string().min(1).max(200).optional(),
    primaryModel: z.string().min(1).max(200).optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  try {
    const { fastModel, primaryModel } = result.data;
    const ops = [];
    if (fastModel !== undefined) {
      ops.push(
        db('settings')
          .insert({ key: 'ai_model_fast', value: fastModel, updated_at: db.fn.now() })
          .onConflict('key')
          .merge({ value: fastModel, updated_at: db.fn.now() }),
      );
    }
    if (primaryModel !== undefined) {
      ops.push(
        db('settings')
          .insert({ key: 'ai_model_primary', value: primaryModel, updated_at: db.fn.now() })
          .onConflict('key')
          .merge({ value: primaryModel, updated_at: db.fn.now() }),
      );
    }
    await Promise.all(ops);
    res.json({ data: { saved: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/settings/ai-models/available (admin only)
// Fetches the live model list from the active provider.
settingsRouter.get('/ai-models/available', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  try {
    const { provider } = await getLLMProvider();
    const models = await provider.listModels();
    res.json({ data: models, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/settings/llm-provider (admin only)
settingsRouter.get('/llm-provider', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  const LLM_KEYS = [
    'llm.provider', 'llm.ollama_base_url', 'llm.ollama_vision_model',
    'llm.ollama_reasoning_model', 'llm.ollama_vision_override',
    'llm.openai_compat_base_url', 'llm.openai_compat_api_key',
    'llm.openai_compat_model', 'llm.openai_compat_fast_model',
    'llm.openai_compat_vision_override', 'llm.timeout_ms',
    'ai.max_tokens_default', 'ai.max_tokens_bank_statement', 'ai.chunk_char_limit',
  ];
  try {
    const rows = await db('settings').whereIn('key', LLM_KEYS).select('key', 'value');
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key as string] = r.value as string;
    res.json({
      data: {
        provider:                    s['llm.provider']                        || 'claude',
        ollamaBaseUrl:               s['llm.ollama_base_url']                 || '',
        ollamaVisionModel:           s['llm.ollama_vision_model']             || 'qwen3-vl:8b',
        ollamaReasoningModel:        s['llm.ollama_reasoning_model']          || 'qwq:32b',
        ollamaVisionOverride:        s['llm.ollama_vision_override']          || '',
        openaiCompatBaseUrl:         s['llm.openai_compat_base_url']          || '',
        openaiCompatApiKey:          s['llm.openai_compat_api_key'] ? '••••••••' + s['llm.openai_compat_api_key'].slice(-4) : '',
        openaiCompatModel:           s['llm.openai_compat_model']             || '',
        openaiCompatFastModel:       s['llm.openai_compat_fast_model']        || '',
        openaiCompatVisionOverride:  s['llm.openai_compat_vision_override']   || '',
        timeoutMs:                   Number(s['llm.timeout_ms'])              || 120000,
        maxTokensDefault:            Number(s['ai.max_tokens_default'])       || 4096,
        maxTokensBankStatement:      Number(s['ai.max_tokens_bank_statement'])|| 32768,
        chunkCharLimit:              Number(s['ai.chunk_char_limit'])         || 30000,
      },
      error: null,
    });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});

// PUT /api/v1/settings/llm-provider (admin only)
settingsRouter.put('/llm-provider', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    return;
  }
  const visionOverrideEnum = z.enum(['', 'true', 'false']).optional();
  const schema = z.object({
    provider:                   z.enum(['claude', 'ollama', 'openai-compat']).optional(),
    ollamaBaseUrl:              z.string().max(500).optional(),
    ollamaVisionModel:          z.string().max(200).optional(),
    ollamaReasoningModel:       z.string().max(200).optional(),
    ollamaVisionOverride:       visionOverrideEnum,
    openaiCompatBaseUrl:        z.string().max(500).optional(),
    openaiCompatApiKey:         z.string().max(500).optional(),
    openaiCompatModel:          z.string().max(200).optional(),
    openaiCompatFastModel:      z.string().max(200).optional(),
    openaiCompatVisionOverride: visionOverrideEnum,
    timeoutMs:                  z.number().int().min(1000).max(600000).optional(),
    maxTokensDefault:           z.number().int().min(512).max(200000).optional(),
    maxTokensBankStatement:     z.number().int().min(1024).max(200000).optional(),
    chunkCharLimit:             z.number().int().min(5000).max(200000).optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
    return;
  }
  const d = result.data;

  // Provider-specific validation: reject saves that leave required fields empty
  if (d.provider) {
    // Merge submitted values with current DB values to check the effective state
    const currentRows = await db('settings')
      .whereIn('key', ['llm.ollama_base_url', 'llm.openai_compat_base_url', 'llm.openai_compat_model'])
      .select('key', 'value');
    const cur: Record<string, string> = {};
    for (const r of currentRows) cur[r.key as string] = r.value as string;

    if (d.provider === 'ollama') {
      const effectiveUrl = d.ollamaBaseUrl ?? cur['llm.ollama_base_url'] ?? '';
      if (!effectiveUrl) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Ollama Base URL is required when using Ollama provider.' } });
        return;
      }
    }
    if (d.provider === 'openai-compat') {
      const effectiveUrl = d.openaiCompatBaseUrl ?? cur['llm.openai_compat_base_url'] ?? '';
      const effectiveModel = d.openaiCompatModel ?? cur['llm.openai_compat_model'] ?? '';
      if (!effectiveUrl) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Base URL is required when using OpenAI-compatible provider.' } });
        return;
      }
      if (!effectiveModel) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Primary Model is required when using OpenAI-compatible provider.' } });
        return;
      }
    }
    if (d.provider === 'claude') {
      const apiKey = await db('settings').where({ key: 'claude_api_key' }).first('value');
      if (!apiKey?.value && !process.env.ANTHROPIC_API_KEY) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Claude API key must be configured before switching to Claude provider.' } });
        return;
      }
    }
  }

  const keyMap: Record<string, string | number | undefined> = {
    'llm.provider':                      d.provider,
    'llm.ollama_base_url':               d.ollamaBaseUrl,
    'llm.ollama_vision_model':           d.ollamaVisionModel,
    'llm.ollama_reasoning_model':        d.ollamaReasoningModel,
    'llm.ollama_vision_override':        d.ollamaVisionOverride,
    'llm.openai_compat_base_url':        d.openaiCompatBaseUrl,
    'llm.openai_compat_api_key':         d.openaiCompatApiKey,
    'llm.openai_compat_model':           d.openaiCompatModel,
    'llm.openai_compat_fast_model':      d.openaiCompatFastModel,
    'llm.openai_compat_vision_override': d.openaiCompatVisionOverride,
    'llm.timeout_ms':                    d.timeoutMs !== undefined ? String(d.timeoutMs) : undefined,
    'ai.max_tokens_default':             d.maxTokensDefault !== undefined ? String(d.maxTokensDefault) : undefined,
    'ai.max_tokens_bank_statement':      d.maxTokensBankStatement !== undefined ? String(d.maxTokensBankStatement) : undefined,
    'ai.chunk_char_limit':               d.chunkCharLimit !== undefined ? String(d.chunkCharLimit) : undefined,
  };
  try {
    const ops = Object.entries(keyMap)
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) =>
        db('settings')
          .insert({ key, value: String(value), updated_at: db.fn.now() })
          .onConflict('key')
          .merge({ value: String(value), updated_at: db.fn.now() }),
      );
    await Promise.all(ops);
    res.json({ data: { saved: true }, error: null });
  } catch (err: unknown) {
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: (err as Error).message } });
  }
});
