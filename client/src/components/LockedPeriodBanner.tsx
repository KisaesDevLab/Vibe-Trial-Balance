// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * A closed (locked) period refuses changes to its data. Pages that edit
 * period rows say so up front with this banner; a refusal that still happens
 * (the period locked meanwhile) reaches the user through the app's global
 * mutation toast.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPeriods } from '../api/periods';
import { useUIStore } from '../store/uiStore';

/** Whether the selected period is locked (shares the period list query). */
export function useSelectedPeriodLocked(): boolean {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const { data } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => { const r = await listPeriods(selectedClientId!); return r.data ?? []; },
    enabled: !!selectedClientId,
  });
  return !!data?.find((p) => p.id === selectedPeriodId)?.locked_at;
}

export function LockedPeriodBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
      {children}
    </div>
  );
}
