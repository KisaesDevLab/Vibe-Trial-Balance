// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2024–2026 [Project Author]

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AiConsentDialog, AI_PII } from '../AiConsentDialog';
import { AccountSearchDropdown } from '../AccountSearchDropdown';
import { QuickAddAccountModal } from '../QuickAddAccountModal';
import { analyzeCsv, type CsvMatchRow } from '../../api/csvImport';
import { listAccounts, type Account } from '../../api/chartOfAccounts';
import { confirmCsvPyImport } from '../../api/pyComparison';

type Stage = 'consent' | 'upload' | 'analyzing' | 'preview' | 'confirming' | 'done';

interface Props {
  periodId: number;
  clientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PyImportDialog({ periodId, clientId, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>('consent');
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<CsvMatchRow[]>([]);
  const [sourceFilename, setSourceFilename] = useState<string>('');
  const [sourceType, setSourceType] = useState<'csv' | 'excel'>('csv');
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; created: number; total: number } | null>(null);
  const [quickAddIdx, setQuickAddIdx] = useState<number | null>(null);

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      const res = await listAccounts(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });
  const accounts: Account[] = accountsData ?? [];

  const handleConsent = () => setStage('upload');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFilename(file.name);
    setSourceType(file.name.match(/\.xlsx?$/i) ? 'excel' : 'csv');
    setStage('analyzing');
    setError(null);
    try {
      const res = await analyzeCsv(file, periodId, clientId);
      if (res.error) { setError(res.error.message); setStage('upload'); return; }
      setMatches(res.data!.matches);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStage('upload');
    }
  };

  const handleConfirm = async () => {
    setStage('confirming');
    setError(null);
    try {
      const res = await confirmCsvPyImport(periodId, clientId, matches, sourceType, sourceFilename);
      if (res.error) { setError(res.error.message); setStage('preview'); return; }
      setImportResult(res.data!);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
      setStage('preview');
    }
  };

  const updateMatch = (idx: number, updates: Partial<CsvMatchRow>) => {
    setMatches((prev) => prev.map((m, i) => i === idx ? { ...m, ...updates } : m));
  };

  const matchedCount = matches.filter((m) => m.action !== 'skip' && (m.matchedAccountId || m.action === 'create_new')).length;
  const unmatchedCount = matches.filter((m) => m.action !== 'skip' && !m.matchedAccountId && m.action !== 'create_new').length;
  const createNewCount = matches.filter((m) => m.action === 'create_new').length;
  const skippedCount = matches.filter((m) => m.action === 'skip').length;

  // ── Consent stage ────────────────────────────────────────────────────────
  if (stage === 'consent') {
    return (
      <AiConsentDialog
        feature="PY Comparison Import"
        piiItems={AI_PII.csvImport}
        onConfirm={handleConsent}
        onCancel={onClose}
      />
    );
  }

  // ── Done stage ───────────────────────────────────────────────────────────
  if (stage === 'done' && importResult) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
          <div className="px-5 py-4 border-b dark:border-gray-700">
            <h2 className="text-base font-semibold dark:text-white">PY Import Complete</h2>
          </div>
          <div className="px-5 py-4 space-y-2 text-sm dark:text-gray-300">
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-4 py-3 text-green-800 dark:text-green-400">
              <p><strong>{importResult.imported}</strong> accounts imported</p>
              {importResult.created > 0 && <p className="mt-1 text-xs">{importResult.created} new accounts created in COA</p>}
              {importResult.skipped > 0 && <p className="mt-1 text-xs">{importResult.skipped} rows skipped</p>}
            </div>
          </div>
          <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end">
            <button onClick={onSuccess} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-visible">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold dark:text-white">Import PY Trial Balance</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {stage === 'upload' && 'Upload a CSV or Excel file'}
              {stage === 'analyzing' && 'Analyzing file...'}
              {stage === 'preview' && `${matches.length} rows detected — review matches`}
              {stage === 'confirming' && 'Importing...'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-3">{error}</div>}

          {/* Upload stage */}
          {stage === 'upload' && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload a CSV or Excel file containing the prior year final trial balance.
              </p>
              <label className="inline-block">
                <span className="sr-only">Choose file</span>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="block text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 dark:file:border-gray-600 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-gray-700 dark:file:text-gray-300 hover:file:bg-blue-100 dark:hover:file:bg-gray-600"
                />
              </label>
            </div>
          )}

          {/* Analyzing stage */}
          {stage === 'analyzing' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Analyzing file with AI...</p>
              </div>
            </div>
          )}

          {/* Preview stage — match table */}
          {stage === 'preview' && matches.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-3">
                <span className="text-green-700 dark:text-green-400 font-medium">{matchedCount} matched</span>
                {createNewCount > 0 && <span className="text-blue-700 dark:text-blue-400 font-medium">{createNewCount} new</span>}
                {unmatchedCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{unmatchedCount} unmatched</span>}
                {skippedCount > 0 && <span className="text-gray-400">{skippedCount} skipped</span>}
              </div>
              <div className="overflow-auto max-h-[50vh] border border-gray-200 dark:border-gray-700 rounded">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">Import Acct #</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">Import Name</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400 min-w-[14rem]">Map To Account</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-24">Balance</th>
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-16">Skip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {matches.map((m, idx) => {
                      const net = m.debitCents - m.creditCents;
                      const isUnmatched = !m.matchedAccountId && m.action !== 'create_new' && m.action !== 'skip';
                      return (
                        <tr key={idx} className={isUnmatched ? 'bg-amber-50/50 dark:bg-amber-900/10' : m.action === 'create_new' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                          <td className="px-2 py-1 font-mono text-gray-900 dark:text-white">{m.csvAccountNumber ?? '—'}</td>
                          <td className="px-2 py-1 text-gray-700 dark:text-gray-300 truncate max-w-[10rem]">{m.csvAccountName ?? '—'}</td>
                          <td className="px-2 py-1">
                            {m.action === 'skip' ? (
                              <span className="text-gray-400 dark:text-gray-500 text-xs italic">Skipped</span>
                            ) : m.action === 'create_new' ? (
                              <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">
                                + New: {m.csvAccountNumber ?? ''} — {m.csvAccountName ?? ''}
                              </span>
                            ) : (
                              <AccountSearchDropdown
                                accounts={accounts}
                                value={m.matchedAccountId ?? ''}
                                onChange={(accountId) => {
                                  if (accountId === '') {
                                    updateMatch(idx, { matchedAccountId: null, action: 'skip' });
                                  } else {
                                    const acct = accounts.find((a) => a.id === accountId);
                                    updateMatch(idx, {
                                      matchedAccountId: accountId as number,
                                      matchedAccountNumber: acct?.account_number ?? null,
                                      matchedAccountName: acct?.account_name ?? null,
                                      action: 'match',
                                    });
                                  }
                                }}
                                placeholder={isUnmatched ? 'Select account or + New...' : undefined}
                                onCreateNew={() => setQuickAddIdx(idx)}
                              />
                            )}
                          </td>
                          <td className={`px-2 py-1 text-right font-mono tabular-nums ${net < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {net === 0 ? '—' : net < 0 ? `(${(Math.abs(net) / 100).toFixed(2)})` : (net / 100).toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={m.action === 'skip'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateMatch(idx, { action: 'skip' });
                                } else {
                                  updateMatch(idx, { action: m.matchedAccountId ? 'match' : 'match' });
                                }
                              }}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {stage === 'preview' && (
          <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-between items-center shrink-0">
            <button onClick={() => setStage('upload')} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">&larr; Back</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={matchedCount + createNewCount === 0}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Confirm Import ({matchedCount + createNewCount} accounts)
              </button>
            </div>
          </div>
        )}
      </div>

      {quickAddIdx !== null && (
        <QuickAddAccountModal
          clientId={clientId}
          onClose={() => setQuickAddIdx(null)}
          onCreated={(accountId) => {
            // Refresh accounts list
            qc.invalidateQueries({ queryKey: ['chart-of-accounts', clientId] });
            // Set the match to the newly created account
            const newAcct = accounts.find((a) => a.id === accountId);
            updateMatch(quickAddIdx, {
              matchedAccountId: accountId,
              matchedAccountNumber: newAcct?.account_number ?? null,
              matchedAccountName: newAcct?.account_name ?? null,
              action: 'match',
            });
            setQuickAddIdx(null);
          }}
        />
      )}
    </div>
  );
}
