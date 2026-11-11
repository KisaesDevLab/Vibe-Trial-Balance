// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import { listTickmarks, type Tickmark } from '../api/tickmarks';

interface Props {
  clientId: number;
  /** False for a bank entry: only book and tax entries reverse. */
  showReversing: boolean;
  isReversing: boolean;
  onReversingChange: (v: boolean) => void;
  tickmarkId: number | null;
  onTickmarkChange: (v: number | null) => void;
}

/**
 * The entry's tickmark (one mark from the client's library) and the
 * "Reverses next year" flag, shared by the new and edit entry dialogs.
 */
export function JeReversingTickmarkFields({
  clientId, showReversing, isReversing, onReversingChange, tickmarkId, onTickmarkChange,
}: Props) {
  // Same key as the Tickmarks page, so a mark added there shows up here.
  const { data } = useQuery({
    queryKey: ['tickmarks', clientId],
    queryFn: async () => {
      const res = await listTickmarks(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });
  const library: Tickmark[] = data ?? [];

  return (
    <div className="flex flex-wrap items-end gap-6">
      <div>
        <label htmlFor="je-tickmark" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tickmark</label>
        <select
          id="je-tickmark"
          value={tickmarkId ?? ''}
          onChange={(e) => onTickmarkChange(e.target.value === '' ? null : Number(e.target.value))}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="">None</option>
          {library.map((t) => (
            <option key={t.id} value={t.id}>{t.symbol} — {t.description}</option>
          ))}
        </select>
      </div>
      {showReversing && (
        <label
          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-1.5"
          title="Roll forward posts this entry's reversal, dated the first day of the next year"
        >
          <input
            type="checkbox"
            checked={isReversing}
            onChange={(e) => onReversingChange(e.target.checked)}
            className="rounded"
          />
          Reverses next year
        </label>
      )}
    </div>
  );
}
