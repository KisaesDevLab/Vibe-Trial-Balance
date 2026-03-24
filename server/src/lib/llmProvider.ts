/**
 * LLM Provider Abstraction
 *
 * Supports three providers behind a common interface:
 *   - Claude (Anthropic SDK)       — cloud, highest quality, vision native
 *   - Ollama (local/Tailscale)     — self-hosted, full privacy, optional vision model
 *   - OpenAI-compat (vLLM, etc.)  — any endpoint speaking the OpenAI chat API
 *
 * All callers use getLLMProvider() instead of getAiConfig().
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface LLMTextPart   { type: 'text';  text: string }
export interface LLMImagePart  { type: 'image'; base64: string; mimeType: 'image/png' | 'image/jpeg' }
export type LLMContentPart = LLMTextPart | LLMImagePart;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentPart[];
}

export interface LLMParams {
  model: string;
  messages: LLMMessage[];
  system?: string;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMModelInfo {
  id: string;
  displayName: string;
}

export interface LLMProvider {
  readonly providerName: string;
  /** True if this provider/model can accept image content parts */
  readonly supportsVision: boolean;
  complete(params: LLMParams): Promise<LLMResult>;
  /** Yields text chunks; the generator return value carries token usage */
  stream(params: LLMParams): AsyncGenerator<string, LLMUsage, void>;
  listModels(): Promise<LLMModelInfo[]>;
  /**
   * Verifies connectivity. Pass the configured fast model so the probe
   * uses the same model the caller intends to use — avoids breakage when
   * a previously-hardcoded model ID is deprecated.
   */
  healthCheck(model?: string): Promise<void>;
}

// ── Claude (Anthropic) ────────────────────────────────────────────────────────

export class ClaudeProvider implements LLMProvider {
  readonly providerName = 'claude';
  readonly supportsVision = true;

  constructor(private readonly client: Anthropic) {}

  async complete(params: LLMParams): Promise<LLMResult> {
    const validStops = params.stopSequences?.filter((s) => s.trim().length > 0);
    const msg = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      ...(params.system ? { system: params.system } : {}),
      ...(validStops?.length ? { stop_sequences: validStops } : {}),
      messages: params.messages.map(toAnthropicMessage),
    });
    return {
      text: (msg.content[0] as { type: string; text: string }).text,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    };
  }

  async *stream(params: LLMParams): AsyncGenerator<string, LLMUsage, void> {
    const stream = this.client.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      ...(params.system ? { system: params.system } : {}),
      messages: params.messages.map(toAnthropicMessage),
    });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
    const final = await stream.finalMessage();
    return { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens };
  }

  async listModels(): Promise<LLMModelInfo[]> {
    const page = await this.client.models.list({ limit: 100 });
    return page.data.map((m) => ({ id: m.id, displayName: m.display_name ?? m.id }));
  }

  async healthCheck(model?: string): Promise<void> {
    // Use the caller-supplied model (the configured fast model) so this doesn't
    // break when a previously-hardcoded model ID is deprecated by Anthropic.
    const probe = model ?? 'claude-haiku-4-5-20251001';
    await this.client.messages.create({
      model: probe,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
  }
}

function toAnthropicMessage(msg: LLMMessage): Anthropic.Messages.MessageParam {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }
  return {
    role: msg.role,
    content: msg.content.map((part): Anthropic.Messages.ContentBlockParam => {
      if (part.type === 'text') return { type: 'text', text: part.text };
      return {
        type: 'image',
        source: { type: 'base64', media_type: part.mimeType, data: part.base64 },
      };
    }),
  };
}

// ── Ollama + OpenAI-compat (shared implementation) ───────────────────────────

/** Whether a model name hints at vision capability */
function modelSupportsVision(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return ['vl', 'vision', 'llava', 'bakllava', 'moondream', 'cogvlm'].some((t) => lower.includes(t));
}

export class OpenAICompatProvider implements LLMProvider {
  readonly providerName: string;
  readonly supportsVision: boolean;
  private readonly client: OpenAI;

  private readonly configuredModel: string;

  constructor(opts: {
    providerName: string;
    baseURL: string;
    apiKey?: string;
    /** The model this provider uses — used to infer vision support and health check */
    model?: string;
    timeoutMs?: number;
    /**
     * Explicit vision capability override. Takes precedence over the name-based
     * heuristic — needed when new model names don't match known patterns.
     * Omit to let the heuristic decide.
     */
    supportsVisionOverride?: boolean;
  }) {
    this.providerName = opts.providerName;
    this.configuredModel = opts.model ?? '';
    this.supportsVision = opts.supportsVisionOverride !== undefined
      ? opts.supportsVisionOverride
      : modelSupportsVision(opts.model ?? '');
    this.client = new OpenAI({
      baseURL: opts.baseURL.replace(/\/$/, '') + '/v1',
      apiKey: opts.apiKey || 'local',
      timeout: opts.timeoutMs ?? 120_000,
    });
  }

  async complete(params: LLMParams): Promise<LLMResult> {
    const messages = buildOpenAIMessages(params);
    const validStops = params.stopSequences?.filter((s) => s.trim().length > 0);
    const res = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      messages,
      ...(validStops?.length ? { stop: validStops } : {}),
    });
    const text = res.choices[0]?.message?.content ?? '';
    return {
      text,
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    };
  }

  async *stream(params: LLMParams): AsyncGenerator<string, LLMUsage, void> {
    const messages = buildOpenAIMessages(params);
    const stream = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    });
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) yield text;
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }
    return { inputTokens, outputTokens };
  }

  async listModels(): Promise<LLMModelInfo[]> {
    try {
      // Ollama's /api/tags also works via /v1/models with the openai compat layer
      const list = await this.client.models.list();
      return list.data.map((m) => ({ id: m.id, displayName: m.id }));
    } catch {
      return [];
    }
  }

  async healthCheck(model?: string): Promise<void> {
    await this.client.chat.completions.create({
      model: model ?? this.configuredModel,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
  }
}

function buildOpenAIMessages(params: LLMParams): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (params.system) {
    out.push({ role: 'system', content: params.system });
  }
  for (const msg of params.messages) {
    if (typeof msg.content === 'string') {
      out.push({ role: msg.role, content: msg.content });
    } else {
      const content: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map((part) => {
        if (part.type === 'text') return { type: 'text', text: part.text };
        return {
          type: 'image_url',
          image_url: { url: `data:${part.mimeType};base64,${part.base64}` },
        };
      });
      if (msg.role === 'user') {
        out.push({ role: 'user', content });
      } else {
        // assistant with array content — flatten to string for compat
        out.push({ role: 'assistant', content: content.map((p) => ('text' in p ? p.text : '')).join('') });
      }
    }
  }
  return out;
}

// ── Config shape returned to callers ─────────────────────────────────────────

export interface LLMConfig {
  provider: LLMProvider;
  fastModel: string;
  primaryModel: string;
  providerName: string;
}
