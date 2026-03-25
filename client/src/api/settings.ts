import { apiFetch } from './client';

export interface SettingsData {
  claude_api_key: { masked: string | null; updated_at: string } | null;
}

export const getSettings = () => apiFetch<SettingsData>('/settings');

export const saveSettings = (data: { claudeApiKey?: string }) =>
  apiFetch<{ saved: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteClaudeApiKey = () =>
  apiFetch<{ deleted: boolean }>('/settings/claude-api-key', { method: 'DELETE' });

export const testClaudeKey = () =>
  apiFetch<{ valid: boolean; message?: string }>('/settings/test-claude-key', { method: 'POST' });

export const testLLM = () =>
  apiFetch<{ valid: boolean; provider?: string; message?: string }>('/settings/test-llm', { method: 'POST' });

export type LLMProvider = 'claude' | 'ollama' | 'openai-compat';

export interface LLMProviderSettings {
  provider: LLMProvider;
  ollamaBaseUrl: string;
  ollamaVisionModel: string;
  ollamaReasoningModel: string;
  /** 'true'/'false' to override vision detection; '' = auto-detect from model name */
  ollamaVisionOverride: string;
  openaiCompatBaseUrl: string;
  openaiCompatApiKey: string;
  /** Primary (capable) model */
  openaiCompatModel: string;
  /** Optional separate fast/cheap model; falls back to openaiCompatModel if blank */
  openaiCompatFastModel: string;
  /** 'true'/'false' to override vision detection; '' = auto-detect from model name */
  openaiCompatVisionOverride: string;
  timeoutMs: number;
  /** Max output tokens for general AI calls (default: 4096) */
  maxTokensDefault: number;
  /** Max output tokens for bank statement PDF extraction (default: 16384) */
  maxTokensBankStatement: number;
  /** Max characters per chunk for large statement processing (default: 40000) */
  chunkCharLimit: number;
}

export const getLLMProviderSettings = () =>
  apiFetch<LLMProviderSettings>('/settings/llm-provider');

export const saveLLMProviderSettings = (data: Partial<LLMProviderSettings>) =>
  apiFetch<{ saved: boolean }>('/settings/llm-provider', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
