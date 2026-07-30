// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Vibe AI Router driver (MIG-1, dual-mode per the router-option addendum Q-063/Q-064).
 *
 * When VIBE_AI_MODE=router, ALL AI traffic goes through the appliance's Vibe AI Router:
 * this app stops choosing providers and models — the task class is the only knob, and
 * router policy decides model, fallback, budgets, scrubbing, and cost tracking. `direct`
 * (the default) keeps the Claude/Ollama/OpenAI-compat providers for standalone
 * single-install deployments, where no router exists.
 *
 * NO silent cross-mode fallback: a router outage surfaces as an error. Quietly retrying
 * against a direct provider would ship the prompt around the router's scrubber and ledger.
 */

import {
  VibeAiClient,
  VibeAiError,
  type ChatMessage,
  type RequestOptions,
  type StreamEvent,
} from './vibeAiClient';
import type {
  LLMMessage,
  LLMModelInfo,
  LLMParams,
  LLMProvider,
  LLMResult,
  LLMUsage,
} from './llmProvider';

// ── mode flag ────────────────────────────────────────────────────────────────

export type AiMode = 'direct' | 'router';

export function aiMode(): AiMode {
  return process.env.VIBE_AI_MODE === 'router' ? 'router' : 'direct';
}

/**
 * Boot-time validation (call from app.ts before listen). Mirrors the router's own
 * refuse-to-boot-on-invalid-config convention: router mode without both the URL and
 * the app token is a misconfiguration, not something to limp through — limping means
 * every AI feature errors at request time with a worse message.
 */
export function validateAiModeEnv(): string | null {
  const mode = process.env.VIBE_AI_MODE;
  if (mode && mode !== 'direct' && mode !== 'router') {
    return `VIBE_AI_MODE must be "direct" or "router" (got "${mode}")`;
  }
  if (mode === 'router') {
    if (!process.env.VIBE_AI_ROUTER_URL || !process.env.VIBE_AI_TOKEN) {
      return 'VIBE_AI_MODE=router requires both VIBE_AI_ROUTER_URL and VIBE_AI_TOKEN. ' +
        'Set them (the appliance mints the token during "vibe enable"), or set VIBE_AI_MODE=direct.';
    }
  }
  return null;
}

// ── this app's task classes ──────────────────────────────────────────────────

/**
 * Task classes vibe-tb uses. The first three are default-pack classes (already
 * declared router-side with reviewed sensitivities); the last three are new and
 * start local_only on the router until the operator widens them.
 */
export const TB_TASK_CLASSES = {
  /** Account/tax-line classification, CSV mapping, bank-txn categorization (local_only) */
  CLASSIFICATION: 'tb_classification',
  /** Trial-balance PDF import — vision + structured extraction (cloud_deidentified) */
  DOC_EXTRACT: 'tb_doc_extract',
  /** Public-knowledge lookups with no client data, e.g. model pricing fetch (cloud_allowed) */
  RESEARCH_SUMMARY: 'tb_research_summary',
  /** NEW: bank-statement PDF transaction extraction (full statements — starts local_only) */
  BANK_STATEMENT_EXTRACT: 'tb_bank_statement_extract',
  /** NEW: in-app support chat over the knowledge base (streaming — starts local_only) */
  SUPPORT_CHAT: 'tb_support_chat',
  /** NEW: period diagnostics observations over TB/GL data (starts local_only) */
  DIAGNOSTICS: 'tb_diagnostics',
} as const;

// ── the provider ─────────────────────────────────────────────────────────────

export interface RouterProviderConfig {
  /** e.g. http://vibe-ai-router:8220 (internal docker DNS on the appliance) */
  baseUrl: string;
  /** app token minted in the router console — never a provider key */
  token: string;
  /** injectable for tests */
  fetch?: typeof fetch;
}

function toChatMessages(params: LLMParams): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (params.system) out.push({ role: 'system', content: params.system });
  for (const msg of params.messages) {
    if (typeof msg.content === 'string') {
      out.push({ role: msg.role, content: msg.content });
    } else {
      out.push({
        role: msg.role,
        content: msg.content.map((part) =>
          part.type === 'text'
            ? { type: 'text' as const, text: part.text }
            : {
                type: 'image_url' as const,
                image_url: { url: `data:${part.mimeType};base64,${part.base64}` },
              },
        ),
      });
    }
  }
  return out;
}

function toRequestOptions(params: LLMParams, signal?: AbortSignal): RequestOptions {
  const validStops = params.stopSequences?.filter((s) => s.trim().length > 0);
  return {
    ...(params.maxTokens !== undefined ? { maxTokens: params.maxTokens } : {}),
    ...(validStops?.length ? { stop: validStops } : {}),
    ...(params.userId != null ? { userId: String(params.userId) } : {}),
    ...(params.clientId != null ? { clientRef: String(params.clientId) } : {}),
    ...(signal ? { signal } : {}),
  };
}

function taskClassOf(params: LLMParams): string {
  // Fail closed: an unmapped call site must not silently ride on some default
  // class — sensitivity, scrubbing, and budgets all derive from the class.
  if (!params.taskClass) {
    throw new Error(
      'Vibe AI Router mode: this call site did not declare a task class (params.taskClass). ' +
      'Every AI call must name one — see TB_TASK_CLASSES in routerProvider.ts.',
    );
  }
  return params.taskClass;
}

function asLlmError(err: unknown): Error {
  if (err instanceof VibeAiError) {
    return new Error(`Vibe AI Router: ${err.message} (${err.code})`);
  }
  return new Error(
    `Vibe AI Router unreachable: ${err instanceof Error ? err.message : String(err)}. ` +
    'Router mode never falls back to a direct provider — check the router service.',
  );
}

export class RouterLLMProvider implements LLMProvider {
  readonly providerName = 'vibe_router';
  /**
   * Vision capability is a per-task-class property in router mode (tb_doc_extract and
   * tb_bank_statement_extract require vision-capable models at config time), so the
   * blanket answer here is true; the router rejects with a clear error if an image
   * reaches a class whose bound model cannot serve it.
   */
  readonly supportsVision = true;

  private readonly client: VibeAiClient;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(cfg: RouterProviderConfig) {
    if (!cfg.baseUrl || !cfg.token) {
      throw new Error('RouterLLMProvider: baseUrl and token are required');
    }
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    this.fetchFn = cfg.fetch ?? fetch;
    this.client = new VibeAiClient({
      baseUrl: cfg.baseUrl,
      token: cfg.token,
      ...(cfg.fetch ? { fetch: cfg.fetch } : {}),
    });
  }

  async complete(params: LLMParams): Promise<LLMResult> {
    try {
      // params.model is deliberately NOT forwarded: in router mode, model choice is
      // router policy's job — an app-pinned model would bypass the admin's config.
      const result = await this.client.complete(
        taskClassOf(params),
        toChatMessages(params),
        toRequestOptions(params),
      );
      return {
        text: result.content,
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        stopReason: result.finishReason,
        servedModel: result.model,
      };
    } catch (err) {
      throw asLlmError(err);
    }
  }

  async *stream(params: LLMParams): AsyncGenerator<string, LLMUsage, void> {
    // Abort the upstream request the moment the consumer stops iterating
    // (client disconnect) — orphaned streams burn firm tokens (router invariant:
    // disconnects must abort upstream within 1s).
    const abort = new AbortController();
    const usage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
    let gen: AsyncGenerator<StreamEvent> | undefined;
    try {
      gen = this.client.stream(taskClassOf(params), toChatMessages(params), toRequestOptions(params, abort.signal));
      for await (const event of gen) {
        if (event.delta) yield event.delta;
        if (event.usage) {
          usage.inputTokens = event.usage.promptTokens;
          usage.outputTokens = event.usage.completionTokens;
        }
      }
      return usage;
    } catch (err) {
      throw asLlmError(err);
    } finally {
      abort.abort();
      await gen?.return?.(undefined as never).then(() => undefined, () => undefined);
    }
  }

  async listModels(): Promise<LLMModelInfo[]> {
    // Apps do not pick models in router mode; the console owns the catalog.
    return [];
  }

  async healthCheck(): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/healthz`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      throw new Error(`Vibe AI Router health check failed: HTTP ${res.status}`);
    }
  }
}

// ── singleton + boot registration ────────────────────────────────────────────

let cached: RouterLLMProvider | null = null;

export function routerProvider(): RouterLLMProvider {
  if (!cached) {
    cached = new RouterLLMProvider({
      baseUrl: process.env.VIBE_AI_ROUTER_URL ?? '',
      token: process.env.VIBE_AI_TOKEN ?? '',
    });
  }
  return cached;
}

/** Test seam. */
export function _setRouterProviderForTests(p: RouterLLMProvider | null): void {
  cached = p;
}

/**
 * Declare this app's task classes on the router (idempotent, version-stamped).
 * Fired at boot in router mode; failure must not block boot — the router may not
 * be healthy yet, and requests made before registration completes fail closed at
 * the router (unknown task class), which is correct. Retries with backoff ≤60s.
 */
export function registerTbTaskClasses(opts?: { fetch?: typeof fetch; maxAttempts?: number }): void {
  if (aiMode() !== 'router') return;
  const client = new VibeAiClient({
    baseUrl: process.env.VIBE_AI_ROUTER_URL ?? '',
    token: process.env.VIBE_AI_TOKEN ?? '',
    ...(opts?.fetch ? { fetch: opts.fetch } : {}),
  });
  const maxAttempts = opts?.maxAttempts ?? 10;
  let attempt = 0;

  const tryRegister = async (): Promise<void> => {
    attempt++;
    try {
      const res = await client.registerTaskClasses({
        app: 'vibe-tb',
        version: process.env.npm_package_version ?? 'unknown',
        classes: [
          // Existing default-pack classes: declarations match the pack exactly.
          { key: TB_TASK_CLASSES.CLASSIFICATION, description: 'Trial-balance account classification', requires: { json_schema: true }, defaultMaxTokens: 2048 },
          { key: TB_TASK_CLASSES.DOC_EXTRACT, description: 'Source-document field extraction', requires: { json_schema: true, vision: true }, defaultMaxTokens: 4096 },
          { key: TB_TASK_CLASSES.RESEARCH_SUMMARY, description: 'Public-guidance research summarization', requires: {}, defaultMaxTokens: 8192 },
          // New classes — start local_only on the router until the operator widens them.
          { key: TB_TASK_CLASSES.BANK_STATEMENT_EXTRACT, description: 'Bank-statement PDF transaction extraction (full statements)', requires: { json_schema: true, vision: true }, defaultMaxTokens: 32768 },
          { key: TB_TASK_CLASSES.SUPPORT_CHAT, description: 'In-app support chat over the TB knowledge base (streaming)', requires: {}, defaultMaxTokens: 2048 },
          { key: TB_TASK_CLASSES.DIAGNOSTICS, description: 'Period diagnostics observations over TB/GL data', requires: {}, defaultMaxTokens: 2048 },
        ],
      });
      console.info(`[router-mode] task classes registered (${res.registered.length})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= maxAttempts) {
        console.error(`[router-mode] task-class registration failed after ${attempt} attempts: ${message}. ` +
          'AI requests will fail closed until the router is reachable and classes are registered.');
        return;
      }
      const delayMs = Math.min(60_000, 2_000 * 2 ** (attempt - 1));
      console.warn(`[router-mode] task-class registration attempt ${attempt} failed (${message}); retrying in ${Math.round(delayMs / 1000)}s`);
      const timer = setTimeout(() => { void tryRegister(); }, delayMs);
      timer.unref?.();
    }
  };

  void tryRegister();
}
