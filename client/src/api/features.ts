// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { apiFetch, type ApiResult } from './client';

export interface FeatureFlags {
  ai: boolean;
}

export function getFeatures(): Promise<ApiResult<FeatureFlags>> {
  return apiFetch<FeatureFlags>('/api/v1/features');
}
