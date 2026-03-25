import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import {
  ClaudeProvider,
  OpenAICompatProvider,
  type LLMConfig,
  type LLMProvider,
} from './llmProvider';

export const DEFAULT_FAST_MODEL    = 'claude-haiku-4-5-20251001';
export const DEFAULT_PRIMARY_MODEL = 'claude-sonnet-4-6';

// ── New provider-agnostic entry point ─────────────────────────────────────────

/**
 * Reads LLM provider settings from the DB and returns a configured LLMProvider
 * plus the fast and primary model names for this provider.
 *
 * Provider selection order:
 *   1. settings: llm.provider  (claude | ollama | openai-compat)
 *   2. Defaults to 'claude' if key is missing or blank.
 */
export async function getLLMProvider(): Promise<LLMConfig> {
  const LLM_KEYS = [
    'llm.provider',
    'llm.ollama_base_url',
    'llm.ollama_vision_model',
    'llm.ollama_reasoning_model',
    'llm.ollama_vision_override',
    'llm.openai_compat_base_url',
    'llm.openai_compat_api_key',
    'llm.openai_compat_model',
    'llm.openai_compat_fast_model',
    'llm.openai_compat_vision_override',
    'llm.timeout_ms',
    'claude_api_key',
    'ai_model_fast',
    'ai_model_primary',
  ];

  const rows = await db('settings').whereIn('key', LLM_KEYS).select('key', 'value');
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key as string] = r.value as string;

  const providerName = (s['llm.provider'] || 'claude') as 'claude' | 'ollama' | 'openai-compat';
  const timeoutMs = Number(s['llm.timeout_ms'] || '120000') || 120_000;

  let provider: LLMProvider;
  let fastModel: string;
  let primaryModel: string;

  /** Parse 'true'/'false'/'' override strings into boolean | undefined */
  function parseVisionOverride(val: string | undefined): boolean | undefined {
    if (val === 'true')  return true;
    if (val === 'false') return false;
    return undefined; // blank → let heuristic decide
  }

  if (providerName === 'ollama') {
    const baseURL = s['llm.ollama_base_url'];
    if (!baseURL) throw new Error('Ollama base URL not configured. Set it in Admin > Settings.');
    fastModel    = s['llm.ollama_vision_model']    || 'qwen3-vl:8b';
    primaryModel = s['llm.ollama_reasoning_model'] || 'qwq:32b';
    provider = new OpenAICompatProvider({
      providerName: 'ollama',
      baseURL,
      model: fastModel,
      timeoutMs,
      supportsVisionOverride: parseVisionOverride(s['llm.ollama_vision_override']),
    });
  } else if (providerName === 'openai-compat') {
    const baseURL = s['llm.openai_compat_base_url'];
    if (!baseURL) throw new Error('OpenAI-compatible base URL not configured. Set it in Admin > Settings.');
    primaryModel = s['llm.openai_compat_model'] || '';
    // Separate fast model — falls back to primaryModel if not set
    fastModel    = s['llm.openai_compat_fast_model'] || primaryModel;
    provider = new OpenAICompatProvider({
      providerName: 'openai-compat',
      baseURL,
      apiKey: s['llm.openai_compat_api_key'] || undefined,
      model: primaryModel,
      timeoutMs,
      supportsVisionOverride: parseVisionOverride(s['llm.openai_compat_vision_override']),
    });
  } else {
    // Claude (default)
    const apiKey = s['claude_api_key'] ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Claude API key not configured. Set it in Admin > Settings.');
    fastModel    = s['ai_model_fast']    || DEFAULT_FAST_MODEL;
    primaryModel = s['ai_model_primary'] || DEFAULT_PRIMARY_MODEL;
    provider = new ClaudeProvider(new Anthropic({ apiKey }));
  }

  return { provider, fastModel, primaryModel, providerName };
}

