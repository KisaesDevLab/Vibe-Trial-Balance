// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch, type ApiResult } from './client';

export interface FeatureFlags {
  ai: boolean;
  /** A mail transport is configured — gates invites and self-service reset. */
  mailEnabled: boolean;
}

export function getFeatures(): Promise<ApiResult<FeatureFlags>> {
  // apiFetch already prepends API_BASE_URL (/api/v1) — do not repeat it here.
  return apiFetch<FeatureFlags>('/features');
}
