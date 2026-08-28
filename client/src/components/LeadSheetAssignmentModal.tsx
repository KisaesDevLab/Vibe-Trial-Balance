// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Lead sheet auto-assign preview.
 *
 * Mirrors AssignmentPreviewModal (tax codes) rather than generalising it —
 * that component is tightly coupled to `taxCodes: TaxCode[]` and destabilising
 * a working feature to share a shell isn't worth it.
 *
 * Every suggestion row is rendered, with no cap: you cannot untick a row that
 * isn't drawn.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  previewAutoAssign,
  confirmAutoAssign,
  type AutoAssignMode,
  type LeadSheet,
  type LeadSheetSuggestion,
} from '../api/leadSheets';
import { pushToast } from '../store/uiStore';

interface Props {
  clientId: number;
  leadSheets: LeadSheet[];
  onClose: () => void;
  onApplied: () => void;
}

function confidenceClass(c: number): string {
  if (c >= 0.9) return 'text-green-700 dark:text-green-400 font-semibold';
  if (c >= 0.7) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-gray-500 dark:text-gray-400';
}

const SOURCE_STYLE: Record<LeadSheetSuggestion['source'], string> = {
  rule: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  unmatched: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
};

interface RowState {
  excluded: boolean;
  override: number | null | undefined; // undefined = use the suggestion
}

export function LeadSheetAssignmentModal({ clientId, leadSheets, onClose, onApplied }: Props) {
  const [mode, setMode] = useState<AutoAssignMode>('unassigned_only');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<LeadSheetSuggestion[]>([]);
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void previewAutoAssign(clientId, mode).then((res) => {
      if (cancelled) return;
      if (res.error) { setError(res.error.message); setLoading(false); return; }
      const list = res.data ?? [];
      setSuggestions(list);
      // Default off for anything with no target, and for rows that would
      // overwrite an existing hand-set assignment — a re-run must never
      // silently stomp someone's work.
      // Exclude by default only what there is nothing to do about: no rule
      // matched, or the suggestion already equals the current assignment.
      //
      // A reassignment (currently assigned, rule disagrees) is deliberately
      // INCLUDED in 'all' mode — excluding it made that mode a no-op, since it
      // then offered exactly the rows 'unassigned_only' already covers.
      setRowState(
        Object.fromEntries(list.map((s) => [
          s.accountId,
          { excluded: s.source === 'unmatched' || !s.changed, override: undefined } as RowState,
        ])),
      );
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [clientId, mode]);

  const targetOf = (s: LeadSheetSuggestion): number | null => {
    const st = rowState[s.accountId];
    return st?.override !== undefined ? st.override : s.suggestedLeadSheetId;
  };

  const included = useMemo(
    () => suggestions.filter((s) => !rowState[s.accountId]?.excluded),
    [suggestions, rowState],
  );

  const apply = async () => {
    // A null target is kept, not filtered: deliberately clearing an assignment
    // is a legitimate thing to apply.
    const assignments = included.map((s) => ({ accountId: s.accountId, leadSheetId: targetOf(s) }));
    if (assignments.length === 0) {
      pushToast('Nothing selected to apply.', 'info');
      return;
    }
    setSaving(true);
    const res = await confirmAutoAssign(clientId, assignments);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    pushToast(`Assigned ${res.data?.applied ?? 0} account(s).`, 'success');
    onApplied();
  };

  const setRow = (id: number, patch: Partial<RowState>) =>
    setRowState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } as RowState }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">Auto-assign Lead Sheets</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-3 border-b dark:border-gray-700 flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              checked={mode === 'unassigned_only'}
              onChange={() => setMode('unassigned_only')}
            />
            Unassigned accounts only
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />
            All accounts
            <span className="text-xs text-gray-400 dark:text-gray-500">(may overwrite existing assignments)</span>
          </label>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {included.length} of {suggestions.length} selected
          </span>
        </div>

        {error && (
          <div className="mx-5 mt-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500">Analysing accounts…</div>
          ) : suggestions.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500">
              Nothing to assign — every account already has a lead sheet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-2 py-2 w-8" />
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Acct #</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Account</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Current</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Suggested</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {suggestions.map((s) => {
                  const st = rowState[s.accountId];
                  return (
                    <tr key={s.accountId} className={st?.excluded ? 'opacity-50' : ''}>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={!st?.excluded}
                          onChange={(e) => setRow(s.accountId, { excluded: !e.target.checked })}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs text-gray-600 dark:text-gray-400">{s.accountNumber}</td>
                      <td className="px-2 py-1.5 text-gray-900 dark:text-white">{s.accountName}</td>
                      <td className="px-2 py-1.5 text-xs">
                        <span className={s.currentLeadSheetId !== null && s.changed
                          ? 'text-amber-700 dark:text-amber-400 font-medium'
                          : 'text-gray-500 dark:text-gray-400'}>
                          {s.currentCode ?? '—'}
                        </span>
                        {s.currentLeadSheetId !== null && s.changed && (
                          <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400">will change</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={targetOf(s) ?? ''}
                            onChange={(e) =>
                              setRow(s.accountId, { override: e.target.value === '' ? null : Number(e.target.value) })
                            }
                            className="border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">— none —</option>
                            {leadSheets.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.code ? `${l.code} — ` : ''}{l.name}
                              </option>
                            ))}
                          </select>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${SOURCE_STYLE[s.source]}`}>
                            {s.source === 'rule' ? 'RULE' : 'NO MATCH'}
                          </span>
                        </div>
                      </td>
                      <td className={`px-2 py-1.5 text-right text-xs ${confidenceClass(s.confidence)}`}>
                        {s.confidence > 0 ? `${Math.round(s.confidence * 100)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => void apply()}
            disabled={saving || loading || included.length === 0}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Applying…' : `Apply ${included.length} assignment${included.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
