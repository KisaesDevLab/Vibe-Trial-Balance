// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch, type ApiResult } from './client';

/** Operator identity printed on the public /privacy and /terms pages. Unauthenticated. */
export interface LegalInfo {
  firmName: string;
  firmAddress: string;
  contactEmail: string;
}

export function getLegalInfo(): Promise<ApiResult<LegalInfo>> {
  return apiFetch<LegalInfo>('/public/legal');
}

/** Admin-editable firm identity: PDF headers + the public legal pages. */
export interface FirmIdentity {
  name: string;
  address: string;
  email: string;
}

export function getFirmIdentity(): Promise<ApiResult<FirmIdentity>> {
  return apiFetch<FirmIdentity>('/settings/firm');
}

export function saveFirmIdentity(body: FirmIdentity): Promise<ApiResult<FirmIdentity>> {
  return apiFetch<FirmIdentity>('/settings/firm', { method: 'PUT', body: JSON.stringify(body) });
}
