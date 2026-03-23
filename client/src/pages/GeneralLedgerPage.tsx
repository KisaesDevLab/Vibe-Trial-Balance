import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGeneralLedger, type GLAccount, type GLLine } from '../api/generalLedger';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';
import { downloadXlsx } from '../utils/downloadXlsx';

function fmt(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string): string {
  const s = d.slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${m}/${day}/${y}`;
}

const TYPE_LABEL: Record<string, string> = { book: 'Book AJE', tax: 'Tax AJE', trans: 'Trans' };
const TYPE_CLASS: Record<string, string> = {
  book: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  tax: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  trans: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
};

function runningBalance(normalBalance: string, tbDr: number, tbCr: number, lines: GLLine[], upTo: number): number {
  // Net TB balance in normal-balance direction
  const tbNet = normalBalance === 'debit' ? tbDr - tbCr : tbCr - tbDr;
  // Sum JE lines up to index `upTo` (inclusive)
  let adj = 0;
  for (let i = 0; i <= upTo; i++) {
    const l = lines[i];
    adj += normalBalance === 'debit' ? l.debit - l.credit : l.credit - l.debit;
  }
  return tbNet + adj;
}

function AccountSection({ acct, typeFilter }: { acct: GLAccount; typeFilter: string }) {
  const lines = typeFilter === 'all' ? acct.lines : acct.lines.filter((l) => l.entry_type === typeFilter);

  const adjDr = lines.reduce((s, l) => s + l.debit, 0);
  const adjCr = lines.reduce((s, l) => s + l.credit, 0);
  const closingDr = acct.unadjusted_debit + adjDr;
  const closingCr = acct.unadjusted_credit + adjCr;

  return (
    <div className="mb-6">
      {/* Account header */}
      <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-t px-3 py-1.5 flex items-center gap-3">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{acct.account_number} – {acct.account_name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{acct.category}</span>
      </div>

      <div className="border border-t-0 border-gray-300 dark:border-gray-600 rounded-b overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">Date</th>
              <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-16">Type</th>
              <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 w-16">#</th>
              <th className="px-3 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Description</th>
              <th className="px-3 py-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">Debit</th>
              <th className="px-3 py-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">Credit</th>
              <th className="px-3 py-1.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 w-32">Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* Per-books opening row */}
            <tr className="bg-blue-50/40 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-700">
              <td className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 italic">Per books</td>
              <td colSpan={3} className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 italic">Unadjusted balance</td>
              <td className="px-3 py-1 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(acct.unadjusted_debit)}</td>
              <td className="px-3 py-1 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(acct.unadjusted_credit)}</td>
              <td className="px-3 py-1 text-right text-sm font-mono text-gray-600 dark:text-gray-400">
                {fmt(acct.normal_balance === 'debit' ? acct.unadjusted_debit - acct.unadjusted_credit : acct.unadjusted_credit - acct.unadjusted_debit)}
              </td>
            </tr>

            {/* JE lines */}
            {lines.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">No adjusting entries for this account.</td></tr>
            ) : (
              lines.map((line, idx) => {
                const bal = runningBalance(acct.normal_balance, acct.unadjusted_debit, acct.unadjusted_credit, lines, idx);
                return (
                  <tr key={idx} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(line.entry_date)}</td>
                    <td className="px-3 py-1">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_CLASS[line.entry_type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        {TYPE_LABEL[line.entry_type] ?? line.entry_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">#{line.entry_number}</td>
                    <td className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">{line.description ?? '—'}</td>
                    <td className="px-3 py-1 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(line.debit)}</td>
                    <td className="px-3 py-1 text-right text-sm font-mono text-gray-700 dark:text-gray-300">{fmt(line.credit)}</td>
                    <td className="px-3 py-1 text-right text-sm font-mono text-gray-600 dark:text-gray-400">{fmt(bal)}</td>
                  </tr>
                );
              })
            )}

            {/* Closing / adjusted balance */}
            <tr className="border-t-2 border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800/60">
              <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">Adjusted Balance</td>
              <td className="px-3 py-1.5 text-right text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">{fmt(closingDr)}</td>
              <td className="px-3 py-1.5 text-right text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">{fmt(closingCr)}</td>
              <td className="px-3 py-1.5 text-right text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">
                {fmt(acct.normal_balance === 'debit' ? closingDr - closingCr : closingCr - closingDr)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GeneralLedgerPage() {
  const { selectedPeriodId } = useUIStore();
  const token = useAuthStore((s) => s.token);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showZero, setShowZero] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openPdfPreview(pdfReports.generalLedger(selectedPeriodId) + '?preview=true', token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await downloadPdf(pdfReports.generalLedger(selectedPeriodId), `general-ledger-${selectedPeriodId}.pdf`, token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['general-ledger', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const res = await getGeneralLedger(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: selectedPeriodId !== null,
  });

  const allAccounts = data ?? [];
  const accounts = allAccounts.filter((a) => {
    if (showZero) return true;
    const hasBalance = a.unadjusted_debit !== 0 || a.unadjusted_credit !== 0;
    const hasLines = typeFilter === 'all'
      ? a.lines.length > 0
      : a.lines.some((l) => l.entry_type === typeFilter);
    return hasBalance || hasLines;
  });

  const handleExport = () => {
    const header = ['Account #', 'Account Name', 'Category', 'Date', 'Entry Type', 'Entry #', 'Description', 'Debit', 'Credit'];
    const rows: string[][] = [];
    for (const acct of accounts) {
      // Opening row
      rows.push([acct.account_number, acct.account_name, acct.category, 'Per Books', '', '', 'Unadjusted Balance', String(acct.unadjusted_debit / 100), String(acct.unadjusted_credit / 100)]);
      const lines = typeFilter === 'all' ? acct.lines : acct.lines.filter((l) => l.entry_type === typeFilter);
      for (const l of lines) {
        rows.push([acct.account_number, acct.account_name, acct.category, l.entry_date.slice(0, 10), l.entry_type, String(l.entry_number), l.description ?? '', String(l.debit / 100), String(l.credit / 100)]);
      }
    }
    downloadXlsx(`general-ledger-${selectedPeriodId}.xlsx`, [header, ...rows]);
  };

  if (!selectedPeriodId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No period selected</p>
          <p className="text-sm mt-1">Choose a client and period from the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">General Ledger</h2>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All entry types</option>
            <option value="book">Book AJE</option>
            <option value="tax">Tax AJE</option>
            <option value="trans">Trans</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
            Show zero-balance
          </label>
          <button onClick={handleExport} disabled={!accounts.length} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-40">Export Excel</button>
          <button
            onClick={handlePreview}
            disabled={pdfLoading}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
          >
            {pdfLoading ? 'Generating…' : '↗ Preview PDF'}
          </button>
          <button
            onClick={handleDownload}
            disabled={pdfLoading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {pdfLoading ? 'Generating…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded mt-2 mb-2">
          {pdfError}
        </div>
      )}
      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{(error as Error).message}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-10 text-center text-gray-400 dark:text-gray-500">
          No general ledger data for this period.
        </div>
      ) : (
        <div>{accounts.map((a) => <AccountSection key={a.account_id} acct={a} typeFilter={typeFilter} />)}</div>
      )}
    </div>
  );
}
