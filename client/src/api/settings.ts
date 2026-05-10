// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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

export type LLMProvider = 'claude' | 'ollama' | 'openai' | 'openai-compat';

export interface LLMProviderSettings {
  provider: LLMProvider;
  ollamaBaseUrl: string;
  ollamaVisionModel: string;
  ollamaReasoningModel: string;
  /** 'true'/'false' to override vision detection; '' = auto-detect from model name */
  ollamaVisionOverride: string;
  openaiApiKey: string;
  openaiPrimaryModel: string;
  openaiFastModel: string;
  openaiCompatBaseUrl: string;
  openaiCompatApiKey: string;
  /** Primary (capable) model */
  openaiCompatModel: string;
  /** Optional separate fast/cheap model; falls back to openaiCompatModel if blank */
  openaiCompatFastModel: string;
  /** 'true'/'false' to override vision detection; '' = auto-detect from model name */
  openaiCompatVisionOverride: string;
  /** Separate vision provider for scanned/image PDFs; '' = same as main provider */
  visionProvider: string;
  /** Model for vision tasks; '' = use provider default */
  visionModel: string;
  timeoutMs: number;
  /** Max output tokens for general AI calls (default: 4096) */
  maxTokensDefault: number;
  /** Max output tokens for bank statement PDF extraction (default: 16384) */
  maxTokensBankStatement: number;
  /** Max characters per chunk for large statement processing (default: 40000) */
  chunkCharLimit: number;
  /** Whether OCR pre-processing is enabled */
  ocrEnabled: boolean;
  /** OCR backend: 'llamacpp' (default) or 'ollama-openai' — both use OpenAI /v1/chat/completions */
  ocrProvider: 'llamacpp' | 'ollama-openai';
  /** OCR server base URL (llama.cpp server or Ollama OpenAI-compat endpoint) */
  ocrBaseUrl: string;
  /** OCR model name (default: glm-ocr) */
  ocrModel: string;
  /** Per-page timeout in ms for OCR processing (default: 120000) */
  ocrTimeoutMs: number;
}

export const getLLMProviderSettings = () =>
  apiFetch<LLMProviderSettings>('/settings/llm-provider');

export const saveLLMProviderSettings = (data: Partial<LLMProviderSettings>) =>
  apiFetch<{ saved: boolean }>('/settings/llm-provider', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export interface OpenAIModelInfo {
  id: string;
  displayName: string;
}

export const fetchOpenAIModels = (apiKey: string) =>
  apiFetch<OpenAIModelInfo[]>('/settings/openai-models', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });

export const fetchProviderModels = (provider: string) =>
  apiFetch<OpenAIModelInfo[]>('/settings/provider-models', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });

export const getOcrStatus = () =>
  apiFetch<{ configured: boolean; model: string }>('/settings/ocr-status');

export const testOcr = () =>
  apiFetch<{ valid: boolean; model?: string; message?: string }>('/settings/test-ocr', { method: 'POST' });

// ── Mail (password-reset email transport) ───────────────────────────────────

export type MailTransport = '' | 'smtp' | 'postmark' | 'emailit';

export interface MailSettings {
  transport: MailTransport;
  from: string;
  smtp: {
    host: string;
    port: string;
    user: string;
    secure: boolean;
    hasPassword: boolean;
  };
  postmark: { hasToken: boolean };
  emailit: { hasApiKey: boolean; apiUrl: string };
  envOverride: boolean;
}

/** Sentinel sent from the form for secret fields the admin did not edit —
 *  the server preserves the existing encrypted value. Sending '' clears the
 *  secret. Sending a real value replaces it. */
export const MAIL_SECRET_KEEP = '__keep__';

export interface MailSettingsPatch {
  transport?: MailTransport;
  from?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  /** real value, '' to clear, or MAIL_SECRET_KEEP to leave existing secret untouched */
  smtpPassword?: string;
  smtpSecure?: boolean;
  postmarkToken?: string;
  emailitApiKey?: string;
  emailitApiUrl?: string;
}

export const getMailSettings = () => apiFetch<MailSettings>('/settings/mail');

export const saveMailSettings = (data: MailSettingsPatch) =>
  apiFetch<{ saved: boolean }>('/settings/mail', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/** Sends a test email to the requesting admin's own email. When `data` is
 *  provided, the test uses those form values instead of the persisted ones —
 *  letting the admin verify edits before saving. */
export const testMail = (data?: MailSettingsPatch) =>
  apiFetch<{ sent: boolean; to: string; transport: string }>('/settings/mail/test', {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  });
