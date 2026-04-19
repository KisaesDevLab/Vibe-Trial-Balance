// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { LLMProvider, LLMParams, LLMResult } from './llmProvider';
import { logAiUsageAsync, updateAiUsageStatus, type AiUsageStatus } from './aiUsage';

export interface AiCompleteContext {
  endpoint: string;
  userId?: number | null;
  clientId?: number | null;
}

export interface AiCompleteResult {
  result: LLMResult;
  /** ID of the ai_usage_log row written for this call (null if the insert failed). */
  logId: number | null;
  durationMs: number;
}

/**
 * Thin wrapper around `provider.complete()` that records a full diagnostic
 * entry in ai_usage_log:
 *   - duration, max_tokens, finish_reason
 *   - status='success' on OK, status='error' with errorMessage on throw
 *   - status automatically flipped to 'truncated' when finish_reason indicates
 *     the output was cut off at the token cap
 *
 * If the caller discovers a post-response issue (e.g. JSON parse failure),
 * it should use the returned logId to call markAiUsageParseError().
 */
export async function aiComplete(
  provider: LLMProvider,
  params: LLMParams,
  ctx: AiCompleteContext,
): Promise<AiCompleteResult> {
  const started = Date.now();
  try {
    const result = await provider.complete(params);
    const durationMs = Date.now() - started;

    const truncated = result.stopReason === 'max_tokens' || result.stopReason === 'length';
    const status: AiUsageStatus = truncated ? 'truncated' : 'success';

    const logId = await logAiUsageAsync({
      endpoint:     ctx.endpoint,
      model:        params.model,
      inputTokens:  result.inputTokens,
      outputTokens: result.outputTokens,
      userId:       ctx.userId    ?? null,
      clientId:     ctx.clientId  ?? null,
      status,
      finishReason: result.stopReason ?? null,
      durationMs,
      maxTokens:    params.maxTokens ?? null,
      errorMessage: truncated ? 'Output truncated at max_tokens cap' : null,
    });

    return { result, logId, durationMs };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    await logAiUsageAsync({
      endpoint:     ctx.endpoint,
      model:        params.model,
      inputTokens:  0,
      outputTokens: 0,
      userId:       ctx.userId    ?? null,
      clientId:     ctx.clientId  ?? null,
      status:       'error',
      errorMessage: message,
      durationMs,
      maxTokens:    params.maxTokens ?? null,
    });
    throw err;
  }
}

/** Mark a previously-logged call as a parse failure (non-throwing). */
export function markAiUsageParseError(logId: number | null, reason: string): void {
  void updateAiUsageStatus(logId, { status: 'parse_error', errorMessage: reason });
}
