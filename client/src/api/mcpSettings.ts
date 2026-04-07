// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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
