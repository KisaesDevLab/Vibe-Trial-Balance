// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

import { apiFetch } from './client';

export interface McpTokenStatus {
  configured: boolean;
  masked: string | null;
  updated_at: string | null;
}

export interface McpTokenGenerated {
  token: string; // Full token — shown once only
  masked: string;
}

export const getMcpTokenStatus = () =>
  apiFetch<McpTokenStatus>('/settings/mcp-token');

export const generateMcpToken = () =>
  apiFetch<McpTokenGenerated>('/settings/mcp-token/generate', { method: 'POST' });

export const revokeMcpToken = () =>
  apiFetch<{ revoked: boolean }>('/settings/mcp-token', { method: 'DELETE' });
