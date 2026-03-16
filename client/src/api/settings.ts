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
