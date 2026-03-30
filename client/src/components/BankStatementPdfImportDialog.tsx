// SPDX-License-Identifier: BUSL-1.1
// Copyright (C) 2024–2026 Kisaes LLC

import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import {
  analyzeBankStatementPdf,
  confirmBankStatementPdfImport,
  type BankStatementTransaction,
  type BankStatementAnalysisResult,
} from '../api/bankStatementPdfImport';
import { AccountSearchDropdown } from './AccountSearchDropdown';
import { AiConsentDialog, AI_PII } from './AiConsentDialog';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

function fmtDate(d: string): string {
  if (!d || d.length < 10) return d;
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${m}/${day}/${y}`;
}

// ── Editable cell ────────────────────────────────────────────────────────────

function EditableCell({
  value,
  display,
  onCommit,
  className = '',
  inputClassName = '',
  type = 'text',
}: {
  value: string;
  display: React.ReactNode;
  onCommit: (v: string) => void;
  className?: string;
  inputClassName?: string;
  type?: 'text' | 'date' | 'number';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const cancel = () => { setEditing(false); setDraft(value); };

  if (editing) {
    return (
      <td className={className}>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') cancel();
          }}
          autoFocus
          className={`w-full bg-white dark:bg-gray-700 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-400 ${inputClassName}`}
        />
      </td>
    );
  }

  return (
    <td className={`${className} cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20`} onClick={startEdit}>
      {display}
    </td>
  );
}

// ── Editable row ─────────────────────────────────────────────────────────────

function EditableTransactionRow({
  tx,
  idx,
  onToggleSkip,
  onUpdate,
}: {
  tx: BankStatementTransaction & { skip?: boolean };
  idx: number;
  onToggleSkip: (idx: number) => void;
  onUpdate: (idx: number, field: keyof BankStatementTransaction, value: string | number | null) => void;
}) {
  return (
    <tr className={`${tx.skip ? 'opacity-40' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50`}>
      <td className="px-3 py-1.5 text-center">
        <input
          type="checkbox"
          checked={!tx.skip}
          onChange={() => onToggleSkip(idx)}
          className="rounded border-gray-300 dark:border-gray-600"
        />
      </td>
      <EditableCell
        value={tx.date}
        display={<span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(tx.date)}</span>}
        onCommit={(v) => onUpdate(idx, 'date', v)}
        className="px-3 py-1.5"
        type="date"
      />
      <EditableCell
        value={tx.description}
        display={<span className="text-gray-700 dark:text-gray-300 truncate block max-w-xs" title={tx.description}>{tx.description}</span>}
        onCommit={(v) => onUpdate(idx, 'description', v)}
        className="px-3 py-1.5"
      />
      <EditableCell
        value={tx.checkNumber ?? ''}
        display={<span className="text-gray-500 dark:text-gray-400 font-mono">{tx.checkNumber ?? ''}</span>}
        onCommit={(v) => onUpdate(idx, 'checkNumber', v || null)}
        className="px-3 py-1.5"
      />
      <EditableCell
        value={tx.payeeName ?? ''}
        display={
          tx.payeeName
            ? <span className="text-gray-600 dark:text-gray-400 truncate block max-w-[9rem]" title={tx.payeeName}>{tx.payeeName}</span>
            : <span className="text-gray-300 dark:text-gray-600">—</span>
        }
        onCommit={(v) => onUpdate(idx, 'payeeName', v || null)}
        className="px-3 py-1.5"
      />
      <EditableCell
        value={(tx.amount / 100).toFixed(2)}
        display={
          <span className={`font-mono tabular-nums whitespace-nowrap ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {fmt(tx.amount)}
          </span>
        }
        onCommit={(v) => {
          const parsed = Math.round(parseFloat(v) * 100);
          if (!isNaN(parsed)) onUpdate(idx, 'amount', parsed);
        }}
        className="px-3 py-1.5 text-right"
        inputClassName="text-right font-mono"
        type="number"
      />
    </tr>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clientId: number;
  periodId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Stage = 'upload' | 'analyzing' | 'preview' | 'confirming' | 'done';

export function BankStatementPdfImportDialog({ clientId, periodId, onClose, onSuccess }: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [showConsent, setShowConsent] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState<number | ''>('');
  const [analysis, setAnalysis] = useState<BankStatementAnalysisResult | null>(null);
  const [transactions, setTransactions] = useState<(BankStatementTransaction & { skip?: boolean })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts', clientId],
    queryFn: async () => {
      const res = await listAccounts(clientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });
  const accounts: Account[] = accountsData ?? [];

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setError(null); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') { setSelectedFile(file); setError(null); }
  };

  // ── Analyze ────────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!selectedFile || sourceAccountId === '') return;
    setStage('analyzing');
    setError(null);

    const res = await analyzeBankStatementPdf(selectedFile, clientId);
    if (res.error) {
      setError(res.error.message);
      setStage('upload');
      return;
    }
    if (!res.data) {
      setError('No data returned');
      setStage('upload');
      return;
    }

    setAnalysis(res.data);
    setTransactions(res.data.transactions.map((t) => ({ ...t, skip: false })));
    setStage('preview');
  };

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (sourceAccountId === '') return;
    setStage('confirming');
    setError(null);

    const toImport = transactions.filter((t) => !t.skip);
    const res = await confirmBankStatementPdfImport(
      clientId,
      periodId,
      sourceAccountId as number,
      toImport,
    );

    if (res.error) {
      setError(res.error.message);
      setStage('preview');
      return;
    }

    setResult(res.data);
    setStage('done');
  };

  // ── Computed values ────────────────────────────────────────────────────────

  const activeTxns = transactions.filter((t) => !t.skip);
  const totalDeposits = activeTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalWithdrawals = activeTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const toggleSkip = (idx: number) => {
    setTransactions((prev) => prev.map((t, i) => (i === idx ? { ...t, skip: !t.skip } : t)));
  };

  const updateTxn = useCallback((idx: number, field: keyof BankStatementTransaction, value: string | number | null) => {
    setTransactions((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Bank Statement PDF</h2>
            {stage === 'preview' && analysis && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {analysis.visionMode ? 'Vision mode' : 'Text extraction mode'}
                {analysis.bankName && ` — ${analysis.bankName}`}
                {analysis.accountNumberLast4 && ` ****${analysis.accountNumberLast4}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 overflow-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-400 mb-4">
              {error}
            </div>
          )}

          {/* Stage: Upload */}
          {stage === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
                <div className="text-3xl mb-2">&#128196;</div>
                {selectedFile ? (
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Drop a bank statement PDF here, or click to browse</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Supports digital and scanned bank statements</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Source Account (bank / credit card)</label>
                <AccountSearchDropdown
                  accounts={accounts}
                  value={sourceAccountId}
                  onChange={setSourceAccountId}
                  placeholder="Select the bank account..."
                />
                {sourceAccountId === '' && selectedFile && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">A source account is required to import.</p>
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                AI will analyze the PDF to extract transactions. If the PDF contains check images, the AI will attempt to read payee names from them.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
                <button
                  onClick={() => setShowConsent(true)}
                  disabled={!selectedFile || sourceAccountId === ''}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analyze
                </button>
              </div>
              {showConsent && (
                <AiConsentDialog
                  feature="AI Bank Statement PDF Import"
                  piiItems={AI_PII.bankStatementPdf}
                  onCancel={() => setShowConsent(false)}
                  onConfirm={() => { setShowConsent(false); handleAnalyze(); }}
                />
              )}
            </div>
          )}

          {/* Stage: Analyzing */}
          {stage === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <span className="inline-block w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium">Analyzing bank statement...</p>
              <p className="text-sm mt-1">This may take a moment for longer statements.</p>
            </div>
          )}

          {/* Stage: Preview */}
          {stage === 'preview' && analysis && (
            <div className="space-y-4">
              {/* Statement metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {analysis.statementPeriod && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Statement Period</p>
                    <p className="text-sm font-medium dark:text-white">{fmtDate(analysis.statementPeriod.start)} – {fmtDate(analysis.statementPeriod.end)}</p>
                  </div>
                )}
                {analysis.openingBalance !== null && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Opening Balance</p>
                    <p className="text-sm font-medium font-mono dark:text-white">{fmt(analysis.openingBalance)}</p>
                  </div>
                )}
                {analysis.closingBalance !== null && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Closing Balance</p>
                    <p className="text-sm font-medium font-mono dark:text-white">{fmt(analysis.closingBalance)}</p>
                  </div>
                )}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
                  <p className="text-sm font-medium dark:text-white">{activeTxns.length} of {transactions.length}</p>
                </div>
              </div>

              {/* Summary row */}
              <div className="flex gap-4 text-sm">
                <span className="text-green-700 dark:text-green-400">Deposits: {fmt(totalDeposits)}</span>
                <span className="text-red-600 dark:text-red-400">Withdrawals: ({fmt(totalWithdrawals)})</span>
                <span className="font-semibold dark:text-white">Net: {fmt(totalDeposits - totalWithdrawals)}</span>
              </div>

              {/* Warnings */}
              {analysis.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-3 text-sm text-amber-700 dark:text-amber-400">
                  {analysis.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              {/* Transaction table — click any cell to edit */}
              <p className="text-xs text-gray-500 dark:text-gray-400">Click any cell to edit. Press Enter or Tab to save, Escape to cancel.</p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-8"></th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-20">Check #</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-36">Payee</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {transactions.map((tx, idx) => (
                      <EditableTransactionRow
                        key={idx}
                        tx={tx}
                        idx={idx}
                        onToggleSkip={toggleSkip}
                        onUpdate={updateTxn}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setStage('upload')} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Back</button>
                <button
                  onClick={handleConfirm}
                  disabled={activeTxns.length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Import {activeTxns.length} Transaction{activeTxns.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Stage: Confirming */}
          {stage === 'confirming' && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <span className="inline-block w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium">Importing transactions...</p>
            </div>
          )}

          {/* Stage: Done */}
          {stage === 'done' && result && (
            <div className="space-y-4 py-8 text-center">
              <div className="text-4xl mb-2">&#9989;</div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">Import Complete</p>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>{result.imported} transaction{result.imported !== 1 ? 's' : ''} imported</p>
                {result.duplicates > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">{result.duplicates} duplicate{result.duplicates !== 1 ? 's' : ''} skipped</p>
                )}
              </div>
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => { onSuccess(); onClose(); }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
