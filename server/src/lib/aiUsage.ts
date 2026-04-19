// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { db } from '../db';

export type AiUsageStatus = 'success' | 'error' | 'parse_error' | 'truncated';

export interface LogAiUsageOptions {
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  userId?: number | null;
  clientId?: number | null;
  // ── Diagnostic fields (all optional) ──────────────────────────────────────
  status?: AiUsageStatus;
  finishReason?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  maxTokens?: number | null;
  httpStatus?: number | null;
}

interface ModelPricing {
  input: number;  // $ per million tokens
  output: number;
}

const MAX_ERROR_MESSAGE_CHARS = 2000;

function truncate(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Core insert — returns the inserted row id, or null if logging failed.
 * Never throws: AI usage logging must never break the main request.
 */
async function insertAiUsage(opts: LogAiUsageOptions): Promise<number | null> {
  try {
    const pricingRow = await db('settings').where({ key: 'ai_model_pricing' }).first('value');
    const pricing: Record<string, ModelPricing> = pricingRow?.value
      ? JSON.parse(pricingRow.value as string)
      : {};
    const mp: ModelPricing = pricing[opts.model] ?? { input: 0, output: 0 };
    const estimatedCost =
      (opts.inputTokens / 1_000_000) * mp.input +
      (opts.outputTokens / 1_000_000) * mp.output;

    const [row] = await db('ai_usage_log')
      .insert({
        user_id:            opts.userId   ?? null,
        client_id:          opts.clientId ?? null,
        endpoint:           opts.endpoint,
        model:              opts.model,
        input_tokens:       opts.inputTokens,
        output_tokens:      opts.outputTokens,
        estimated_cost_usd: estimatedCost > 0 ? estimatedCost : null,
        status:             opts.status        ?? 'success',
        finish_reason:      opts.finishReason  ?? null,
        error_message:      truncate(opts.errorMessage, MAX_ERROR_MESSAGE_CHARS),
        duration_ms:        opts.durationMs    ?? null,
        max_tokens:         opts.maxTokens     ?? null,
        http_status:        opts.httpStatus    ?? null,
      })
      .returning('id');

    // Knex pg returns `[{ id }]`; normalize
    const id = typeof row === 'object' && row !== null && 'id' in row
      ? Number((row as { id: unknown }).id)
      : Number(row);
    return Number.isFinite(id) ? id : null;
  } catch (err: unknown) {
    console.debug('[aiUsage] Failed to log:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Fire-and-forget log insert. Never throws, never blocks a response.
 * Use this from hot paths where you don't need the row id back.
 */
export function logAiUsage(opts: LogAiUsageOptions): void {
  void insertAiUsage(opts);
}

/**
 * Awaitable log insert. Returns the row id (or null on failure). Callers that
 * need to later update the row's status (e.g. mark a parse failure after a
 * successful API call) should use this variant.
 */
export function logAiUsageAsync(opts: LogAiUsageOptions): Promise<number | null> {
  return insertAiUsage(opts);
}

/**
 * Update an existing log row's status fields. Used when we detect a
 * post-response problem (e.g. the AI returned text but it wasn't valid JSON).
 * Silent on failure.
 */
export async function updateAiUsageStatus(
  id: number | null,
  patch: {
    status?: AiUsageStatus;
    errorMessage?: string | null;
    httpStatus?: number | null;
  },
): Promise<void> {
  if (id == null) return;
  try {
    const update: Record<string, unknown> = {};
    if (patch.status         !== undefined) update.status        = patch.status;
    if (patch.errorMessage   !== undefined) update.error_message = truncate(patch.errorMessage, MAX_ERROR_MESSAGE_CHARS);
    if (patch.httpStatus     !== undefined) update.http_status   = patch.httpStatus;
    if (Object.keys(update).length === 0) return;
    await db('ai_usage_log').where({ id }).update(update);
  } catch (err: unknown) {
    console.debug('[aiUsage] Failed to update:', err instanceof Error ? err.message : String(err));
  }
}
