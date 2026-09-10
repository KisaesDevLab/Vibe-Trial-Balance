// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { TICKMARK_COLOR_CLASSES, type Tickmark, type TickmarkColor } from '../api/tickmarks';

/**
 * Assign the client's tickmarks to one account for one period.
 *
 * Lifted out of TrialBalancePage so the Trial Balance grid and the lead
 * schedules put marks on an account through the same control — the marks are
 * one set of data (`tb_tickmarks`, keyed by period + account), so two pickers
 * would have been two ways to describe one thing.
 *
 * Takes the account's number and name rather than a row object: the two screens
 * hold different row types over the same account.
 */
export interface TickmarkPickerModalProps {
  accountNumber: string;
  accountName: string;
  /** The client's tickmark library — everything that can be assigned. */
  library: Tickmark[];
  /** What is currently on this account. Only the ids are read — symbol and
   *  colour are taken from `library`, so callers can pass their own row shape
   *  (the lead schedules carry `color` as a plain string). */
  assigned: Array<{ id: number }>;
  onClose: () => void;
  onToggle: (tickmarkId: number) => void;
}

export function TickmarkPickerModal({
  accountNumber,
  accountName,
  library,
  assigned,
  onClose,
  onToggle,
}: TickmarkPickerModalProps) {
  const assignedIds = new Set(assigned.map((a) => a.id));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold dark:text-white">{accountNumber} — {accountName}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Assign Tickmarks</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-3 space-y-1 max-h-80 overflow-y-auto">
          {library.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No tickmarks defined for this client.</p>
          ) : (
            library.map((tm) => {
              const isOn = assignedIds.has(tm.id);
              return (
                <button
                  key={tm.id}
                  onClick={() => onToggle(tm.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                    isOn ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm font-bold shrink-0 ${
                    TICKMARK_COLOR_CLASSES[tm.color as TickmarkColor] ?? TICKMARK_COLOR_CLASSES.gray
                  }`}>
                    {tm.symbol}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{tm.description}</span>
                  {isOn && (
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600">Done</button>
        </div>
      </div>
    </div>
  );
}
