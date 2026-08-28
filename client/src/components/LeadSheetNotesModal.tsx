// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The review conversation on one account of a lead sheet.
 *
 * Notes are resolved rather than deleted: a closed query is evidence that
 * review happened, which is the point of a workpaper. Resolved notes stay
 * visible, greyed, and can be reopened.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listLeadSheetNotes,
  addLeadSheetNote,
  setLeadSheetNoteResolved,
  type LeadSheetMemberRow,
  type LeadSheetNote,
} from '../api/leadSheets';
import { pushToast } from '../store/uiStore';

interface Props {
  periodId: number;
  leadSheetId: number;
  row: LeadSheetMemberRow;
  onClose: () => void;
  onChanged: () => void;
}

export function LeadSheetNotesModal({ periodId, leadSheetId, row, onClose, onChanged }: Props) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const notesQuery = useQuery({
    queryKey: ['lead-sheet-notes', periodId, leadSheetId],
    queryFn: async () => {
      const res = await listLeadSheetNotes(periodId, leadSheetId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  // Only this account's notes; the sheet-level ones live on the page.
  const notes = (notesQuery.data ?? []).filter((n) => n.account_id === row.account_id);

  const add = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const res = await addLeadSheetNote(periodId, leadSheetId, { body: text, accountId: row.account_id });
    setBusy(false);
    if (res.error) { pushToast(res.error.message, 'error'); return; }
    setBody('');
    void notesQuery.refetch();
    onChanged();
  };

  const toggle = async (n: LeadSheetNote) => {
    setBusy(true);
    const res = await setLeadSheetNoteResolved(periodId, leadSheetId, n.id, !n.resolved_at);
    setBusy(false);
    if (res.error) { pushToast(res.error.message, 'error'); return; }
    void notesQuery.refetch();
    onChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-base font-semibold dark:text-white truncate">Notes</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              <span className="font-mono">{row.account_number}</span> {row.account_name}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {notesQuery.isLoading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">
              No notes on this account yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className={`border rounded p-3 ${n.resolved_at
                    ? 'border-gray-200 dark:border-gray-700 opacity-60'
                    : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'}`}
                >
                  <p className={`text-sm whitespace-pre-wrap ${n.resolved_at
                    ? 'text-gray-500 dark:text-gray-400 line-through'
                    : 'text-gray-900 dark:text-white'}`}>
                    {n.body}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{n.author_name ?? 'Unknown'}</span>
                    <span>·</span>
                    <span>{new Date(n.created_at).toLocaleDateString()}</span>
                    {n.resolved_at && (
                      <span className="text-green-700 dark:text-green-400">
                        · resolved by {n.resolved_by_name ?? 'someone'}
                      </span>
                    )}
                    <button
                      onClick={() => void toggle(n)}
                      disabled={busy}
                      className="ml-auto text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-50"
                    >
                      {n.resolved_at ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t dark:border-gray-700 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Add a note or review query for this account…"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
            >
              Close
            </button>
            <button
              onClick={() => void add()}
              disabled={busy || !body.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Add note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
