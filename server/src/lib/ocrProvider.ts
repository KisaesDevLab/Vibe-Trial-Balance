// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

/**
 * OCR Provider — Native Ollama API client for GLM-OCR
 *
 * Uses Ollama's native /api/generate endpoint (NOT the OpenAI-compatible API)
 * because GLM-OCR has documented limitations with the OpenAI-compatible endpoint
 * for vision requests.
 *
 * Key requirements:
 *   - num_ctx: 16384 (Ollama defaults to 4096 which crashes on images)
 *   - temperature: 0 (deterministic OCR output)
 *   - images as raw base64 strings (no data URI prefix)
 */

import { db } from '../db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OcrSettings {
  enabled: boolean;
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

/** Minimum context window to prevent crashes on image processing */
const OCR_NUM_CTX = 16384;

// ── Settings ──────────────────────────────────────────────────────────────────

/**
 * Load OCR settings from the database.
 * OCR is considered "configured" only when enabled=true AND baseUrl is non-empty.
 */
export async function loadOcrSettings(): Promise<OcrSettings> {
  const keys = ['llm.ocr_enabled', 'llm.ocr_base_url', 'llm.ocr_model', 'llm.ocr_timeout_ms'];
  const rows = await db('settings').whereIn('key', keys).select('key', 'value');
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key as string] = r.value as string;
  return {
    enabled: s['llm.ocr_enabled'] === 'true',
    baseUrl: (s['llm.ocr_base_url'] || '').replace(/\/+$/, ''),
    model: s['llm.ocr_model'] || 'glm-ocr',
    timeoutMs: Number(s['llm.ocr_timeout_ms']) || 120_000,
  };
}

/** Whether OCR is enabled and properly configured */
export function isOcrConfigured(settings: OcrSettings): boolean {
  return settings.enabled && !!settings.baseUrl;
}

// ── Single-page OCR ───────────────────────────────────────────────────────────

/**
 * Send a single page image to Ollama's native /api/generate endpoint for OCR.
 */
export async function ocrPage(
  settings: OcrSettings,
  base64Image: string,
): Promise<OcrPageResult> {
  const url = `${settings.baseUrl}/api/generate`;
  const body = JSON.stringify({
    model: settings.model,
    prompt: OCR_PROMPT,
    images: [base64Image],
    stream: false,
    options: {
      num_ctx: OCR_NUM_CTX,
      temperature: 0,
    },
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

  let data: {
    response?: string;
    done?: boolean;
    error?: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };
  try {
    data = await response.json();
  } catch {
    throw new Error('OCR returned invalid JSON response');
  }

  if (data.error) {
    throw new Error(`OCR model error: ${data.error}`);
  }

  return {
    text: data.response ?? '',
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
    done: data.done !== false,
  };
}

// ── Multi-page OCR ────────────────────────────────────────────────────────────

/**
 * Process multiple page images sequentially through OCR.
 *
 * Sequential processing is intentional — OCR is CPU/GPU-bound at ~30-60 seconds
 * per page on consumer hardware. Parallelism doesn't help and may cause thermal
 * throttling or Ollama crashes.
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
        warnings.push(`Page ${i + 1}: OCR may have stopped early (token repeat limit). Text may be incomplete.`);
        console.warn(`[ocr] Page ${i + 1}/${pageImages.length}: done=false — partial text returned`);
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
 * Test connectivity to the OCR Ollama instance.
 * Sends a minimal text-only generate request (no image) to verify the model is loaded.
 */
export async function testOcrConnection(settings: OcrSettings): Promise<void> {
  const url = `${settings.baseUrl}/api/generate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      prompt: 'ping',
      stream: false,
      options: { num_predict: 1 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OCR connection failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  let data: { error?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error('OCR returned invalid JSON response');
  }
  if (data.error) {
    throw new Error(`OCR model error: ${data.error}`);
  }
}
