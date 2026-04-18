// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

/**
 * OCR Provider — OpenAI-compatible chat-completions client for vision OCR
 *
 * Supports two backends, both speaking the OpenAI /v1/chat/completions wire format:
 *   - 'llamacpp'      → llama.cpp server (recommended)
 *   - 'ollama-openai' → Ollama's OpenAI-compatible endpoint
 *
 * Images are sent as data-URI image_url parts. Temperature is pinned to 0 for
 * deterministic OCR output. Context window / max output tokens are tuned to
 * leave room for dense document transcriptions.
 */

import { db } from '../db';
import { assertSafeOutboundUrl } from './urlSafety';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OcrProvider = 'llamacpp' | 'ollama-openai';

export interface OcrSettings {
  enabled: boolean;
  provider: OcrProvider;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface OcrPageResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  done: boolean;
}

export interface OcrPagesResult {
  texts: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
  warnings: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OCR_PROMPT =
  'Read all text from this document image. Preserve the exact layout, columns, numbers, and row structure. Output the text exactly as it appears.';

/**
 * Max completion tokens per page.
 *
 * Sized for worst-case dense tabular documents: a business credit card statement
 * with ~120 transactions or a corporate travel card with heavy FX detail can
 * emit ~5–6k tokens once column alignment is preserved. Tokenizer efficiency on
 * numeric/tabular content is roughly 1 token per 3 chars, worse than prose, so
 * 16,384 gives ~3× headroom. llama.cpp / Ollama don't preallocate for this
 * value, so over-budgeting costs nothing at inference time.
 */
const OCR_MAX_TOKENS = 16384;

// ── Settings ──────────────────────────────────────────────────────────────────

function normalizeProvider(value: string | undefined): OcrProvider {
  return value === 'ollama-openai' ? 'ollama-openai' : 'llamacpp';
}

/**
 * Load OCR settings from the database.
 * OCR is considered "configured" only when enabled=true AND baseUrl is non-empty.
 */
export async function loadOcrSettings(): Promise<OcrSettings> {
  const keys = [
    'llm.ocr_enabled',
    'llm.ocr_provider',
    'llm.ocr_base_url',
    'llm.ocr_model',
    'llm.ocr_timeout_ms',
  ];
  const rows = await db('settings').whereIn('key', keys).select('key', 'value');
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key as string] = r.value as string;
  return {
    enabled: s['llm.ocr_enabled'] === 'true',
    provider: normalizeProvider(s['llm.ocr_provider']),
    baseUrl: (s['llm.ocr_base_url'] || '').replace(/\/+$/, ''),
    model: s['llm.ocr_model'] || 'glm-ocr',
    timeoutMs: Number(s['llm.ocr_timeout_ms']) || 120_000,
  };
}

/** Whether OCR is enabled and properly configured */
export function isOcrConfigured(settings: OcrSettings): boolean {
  return settings.enabled && !!settings.baseUrl;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

type ChatCompletionChoice = {
  message?: { content?: string | Array<{ type?: string; text?: string }> };
  finish_reason?: string;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string } | string;
};

function extractText(choice: ChatCompletionChoice): string {
  const content = choice.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p === 'object' && typeof p.text === 'string' ? p.text : ''))
      .join('');
  }
  return '';
}

function extractErrorMessage(data: ChatCompletionResponse): string | null {
  if (!data.error) return null;
  if (typeof data.error === 'string') return data.error;
  return data.error.message ?? 'unknown error';
}

// ── Single-page OCR ───────────────────────────────────────────────────────────

/**
 * Send a single page image to the configured OpenAI-compatible endpoint for OCR.
 */
export async function ocrPage(
  settings: OcrSettings,
  base64Image: string,
): Promise<OcrPageResult> {
  const url = `${settings.baseUrl}/v1/chat/completions`;
  await assertSafeOutboundUrl(url);
  const body = JSON.stringify({
    model: settings.model,
    temperature: 0,
    max_tokens: OCR_MAX_TOKENS,
    stream: false,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${base64Image}` },
          },
        ],
      },
    ],
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(settings.timeoutMs),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OCR request failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  let data: ChatCompletionResponse;
  try {
    data = (await response.json()) as ChatCompletionResponse;
  } catch {
    throw new Error('OCR returned invalid JSON response');
  }

  const errMsg = extractErrorMessage(data);
  if (errMsg) throw new Error(`OCR model error: ${errMsg}`);

  const choice = data.choices?.[0];
  const text = choice ? extractText(choice) : '';
  const finish = choice?.finish_reason ?? 'stop';

  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    done: finish === 'stop' || finish === 'end_turn',
  };
}

// ── Multi-page OCR ────────────────────────────────────────────────────────────

/**
 * Process multiple page images sequentially through OCR.
 *
 * Sequential processing is intentional — OCR is CPU/GPU-bound at ~30-60 seconds
 * per page on consumer hardware. Parallelism doesn't help and may cause thermal
 * throttling or backend crashes.
 */
export async function ocrPages(
  settings: OcrSettings,
  pageImages: string[],
  onProgress?: (page: number, total: number) => void,
): Promise<OcrPagesResult> {
  const texts: string[] = [];
  const warnings: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < pageImages.length; i++) {
    try {
      const result = await ocrPage(settings, pageImages[i]);
      texts.push(result.text);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      if (!result.done) {
        warnings.push(`Page ${i + 1}: OCR may have stopped early (token limit). Text may be incomplete.`);
        console.warn(`[ocr] Page ${i + 1}/${pageImages.length}: finish_reason != stop — partial text returned`);
      }

      console.log(
        `[ocr] Page ${i + 1}/${pageImages.length}: ${result.text.length} chars, ` +
        `${result.inputTokens} in / ${result.outputTokens} out tokens`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Generic message for client; full error logged server-side only
      warnings.push(`Page ${i + 1}: OCR processing failed.`);
      // Push empty string instead of a placeholder marker — placeholders would
      // be sent to the AI prompt and could confuse structured extraction.
      texts.push('');
      console.error(`[ocr] Page ${i + 1}/${pageImages.length} failed:`, msg);
    }

    onProgress?.(i + 1, pageImages.length);
  }

  return { texts, totalInputTokens, totalOutputTokens, warnings };
}

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Test connectivity to the OCR backend by hitting the OpenAI-compatible
 * /v1/models endpoint. Both llama.cpp and Ollama's OpenAI-compat surface this.
 */
export async function testOcrConnection(settings: OcrSettings): Promise<void> {
  const url = `${settings.baseUrl}/v1/models`;
  await assertSafeOutboundUrl(url);
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OCR connection failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  let data: { data?: Array<{ id?: string }>; error?: { message?: string } | string };
  try {
    data = await response.json();
  } catch {
    throw new Error('OCR returned invalid JSON response');
  }

  if (data.error) {
    const msg = typeof data.error === 'string' ? data.error : data.error.message ?? 'unknown error';
    throw new Error(`OCR backend error: ${msg}`);
  }

  // Best-effort model check: if the backend returns a model list, warn when
  // the configured model is absent. llama.cpp typically serves a single model
  // regardless of what's requested, so a missing entry isn't strictly fatal.
  const models = (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string');
  if (models.length > 0 && !models.some((id) => id === settings.model || id.startsWith(settings.model))) {
    console.warn(
      `[ocr] Configured model "${settings.model}" not found in /v1/models response. ` +
      `Backend advertises: ${models.slice(0, 5).join(', ')}${models.length > 5 ? ', …' : ''}`,
    );
  }
}
