// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch, type ApiResult } from './client';

export interface FeatureFlags {
  ai: boolean;
}

export function getFeatures(): Promise<ApiResult<FeatureFlags>> {
  return apiFetch<FeatureFlags>('/api/v1/features');
}
