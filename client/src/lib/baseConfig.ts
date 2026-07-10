// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

const RAW_BASE = import.meta.env.BASE_URL || '/';

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

// Vite's BASE_URL always ends with a slash. React Router's basename must NOT
// have a trailing slash (and '' is the correct value for root-mounted apps).
export const BASE_URL = ensureTrailingSlash(RAW_BASE);

export const ROUTER_BASENAME = BASE_URL === '/' ? '' : BASE_URL.replace(/\/$/, '');

export const API_BASE_URL = `${BASE_URL}api/v1`;

export function withBase(path: string): string {
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_URL}${trimmed}`;
}

export function apiUrl(path: string): string {
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${trimmed}`;
}
