import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  verifyImport,
  getVerificationResult,
  type DocumentImport,
  type VerificationResult,
  type VerificationDetail,
} from '../api/pdfImport';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCents(cents: number | null): string {
  if (cents === null || cents === undefined) return '—';
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${formatted})` : formatted;
}

function statusColor(status: VerificationDetail['status']): string {
  switch (status) {
    case 'match':          return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
    case 'extra_in_tb':    return 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
    case 'discrepancy':    return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
    case 'missing_from_tb': return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
    default:               return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60';
  }
}

function statusLabel(status: VerificationDetail['status']): string {
  switch (status) {
    case 'match':           return 'Match';
    case 'extra_in_tb':     return 'Extra in TB';
    case 'discrepancy':     return 'Discrepancy';
    case 'missing_from_tb': return 'Missing from TB';
    default:                return status;
  }
}

function overallBadge(result: VerificationResult): JSX.Element {
  if (result.overallStatus === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
        </svg>
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      Discrepancies Found
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface VerificationPanelProps {
  importRecord: DocumentImport;
  periodId: number;
  isPeriodLocked: boolean;
}

export function VerificationPanel({ importRecord, periodId, isPeriodLocked }: VerificationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: cachedResult, isLoading: loadingCached } = useQuery({
    queryKey: ['verification', importRecord.id],
    queryFn: async () => {
      const res = await getVerificationResult(importRecord.id);
      // 404 with NOT_VERIFIED is expected — return null
      if (res.error?.code === 'NOT_VERIFIED' || res.error?.code === 'NOT_FOUND') return null;
      if (res.error) throw new Error(res.error.message);
      return res.data ?? null;
    },
    retry: false,
  });

  const verifyMut = useMutation({
    mutationFn: () => verifyImport(importRecord.id, periodId),
    onSuccess: (res) => {
      if (res.data) {
        qc.setQueryData<VerificationResult | null>(['verification', importRecord.id], res.data);
      }
    },
  });

  const result: VerificationResult | null = verifyMut.data?.data ?? cachedResult ?? null;
  const isVerifying = verifyMut.isPending;
  const hasResult = result !== null;

  const importedDate = new Date(importRecord.imported_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm mx-4 mb-4">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Source Document Verification</span>
          {loadingCached && (
            <span className="text-xs text-gray-400">Loading…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasResult ? (
            overallBadge(result)
          ) : (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              Not Verified
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
          {/* Import info */}
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Imported from{' '}
            <span className="font-medium uppercase">{importRecord.import_type}</span>
            {importRecord.document_type ? ` (${importRecord.document_type.replace('_', ' ')})` : ''}
            {' '}on {importedDate}
          </p>

          {/* Verify / Re-verify button */}
          <div className="flex items-center gap-3">
            {!hasResult ? (
              <button
                type="button"
                onClick={() => verifyMut.mutate()}
                disabled={isVerifying || isPeriodLocked}
                title={isPeriodLocked ? 'Period is locked' : undefined}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? 'Verifying…' : 'Verify Against Source'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => verifyMut.mutate()}
                disabled={isVerifying}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 text-gray-600 dark:text-gray-400"
              >
                {isVerifying ? 'Re-verifying…' : 'Re-verify'}
              </button>
            )}
            {verifyMut.isError && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {verifyMut.error instanceof Error ? verifyMut.error.message : 'Verification failed'}
              </span>
            )}
            {verifyMut.data?.error && (
              <span className="text-xs text-red-600 dark:text-red-400">{verifyMut.data.error.message}</span>
            )}
          </div>

          {/* Summary bar */}
          {hasResult && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-semibold text-green-700 dark:text-green-400">{result.summary.matched}</span>
                {' of '}
                <span className="font-semibold">{result.summary.total}</span>
                {' accounts match'}
              </span>
              {result.summary.discrepancies > 0 && (
                <span className="text-red-600 dark:text-red-400 font-medium">{result.summary.discrepancies} discrepanc{result.summary.discrepancies === 1 ? 'y' : 'ies'}</span>
              )}
              {result.summary.missingFromTb > 0 && (
                <span className="text-red-600 dark:text-red-400 font-medium">{result.summary.missingFromTb} missing from TB</span>
              )}
              {result.summary.extraInTb > 0 && (
                <span className="text-yellow-700 dark:text-yellow-400 font-medium">{result.summary.extraInTb} extra in TB</span>
              )}
            </div>
          )}

          {/* Detail table */}
          {hasResult && result.details.length > 0 && (
            <div className="overflow-auto max-h-80 border border-gray-200 dark:border-gray-700 rounded">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Account</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">PDF Amount</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">TB Amount</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">Difference</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {result.details.map((d, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/40 dark:bg-gray-800/60'}>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                        {d.accountNumber && (
                          <span className="text-gray-400 dark:text-gray-500 mr-1">{d.accountNumber}</span>
                        )}
                        {d.accountName}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono tabular-nums">{fmtCents(d.pdfAmount)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono tabular-nums">{fmtCents(d.tbAmount)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${d.difference !== 0 ? 'text-red-600 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
                        {d.difference === 0 ? '—' : fmtCents(d.difference)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(d.status)}`}>
                          {statusLabel(d.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
