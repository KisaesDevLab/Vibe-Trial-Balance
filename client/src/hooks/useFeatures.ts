// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { DEFAULT_FLAGS, getFeatures, type FeatureFlags } from '../api/features';

// Module-scoped cache so the /api/v1/features call only fires once per page
// load even if multiple components subscribe (Sidebar, ChatBubble, etc.).
let cached: FeatureFlags | null = null;
let inflight: Promise<FeatureFlags> | null = null;
const subscribers = new Set<(f: FeatureFlags) => void>();

function loadFeatures(): Promise<FeatureFlags> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = getFeatures().then((res) => {
    const flags: FeatureFlags = { ...DEFAULT_FLAGS, ...(res.data ?? {}) };
    cached = flags;
    inflight = null;
    subscribers.forEach((fn) => fn(flags));
    return flags;
  });
  return inflight;
}

/**
 * Forget the cached flags so the next subscriber refetches. Called after an
 * admin saves something the flags report (the 2FA policy, the public URL).
 */
export function resetFeaturesCache(): void {
  cached = null;
  inflight = null;
  void loadFeatures();
}

/**
 * Returns server-reported feature flags. Returns `null` until the first
 * fetch completes — components should treat null as "unknown, hide
 * AI-dependent UI" to avoid a flash of broken state.
 */
export function useFeatures(): FeatureFlags | null {
  const [flags, setFlags] = useState<FeatureFlags | null>(cached);

  useEffect(() => {
    let mounted = true;
    const fn = (f: FeatureFlags) => { if (mounted) setFlags(f); };
    subscribers.add(fn);
    if (cached) setFlags(cached);
    else loadFeatures().catch(() => { if (mounted) setFlags(DEFAULT_FLAGS); });
    return () => { mounted = false; subscribers.delete(fn); };
  }, []);

  return flags;
}
