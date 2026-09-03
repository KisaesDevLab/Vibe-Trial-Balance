// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useMemo } from 'react';
import type { PyComparisonAccount } from '../../api/pyComparison';

/** Format a net balance (debit - credit) in cents. Positive normal, negative in red parentheses. */
function fmtNet(cents: number): string {
  if (cents === 0) return '—';
  const abs = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${abs})` : abs;
}

const CATEGORY_ORDER: Record<string, number> = { assets: 0, liabilities: 1, equity: 2, revenue: 3, expenses: 4 };
const CATEGORY_LABELS: Record<string, string> = { assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity', revenue: 'Revenue', expenses: 'Expenses' };

interface Props {
  accounts: PyComparisonAccount[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  viewMode: 'all' | 'variances';
  searchFilter: string;
  /** Show the true-up and remaining columns — only worth the width once entries exist. */
  showTrueUp: boolean;
}

function netBalance(dr: number, cr: number): number { return dr - cr; }

export function ComparisonTable({ accounts, selectedIds, onSelectionChange, viewMode, searchFilter, showTrueUp }: Props) {
  const filtered = useMemo(() => {
    let list = accounts;
    if (viewMode === 'variances') list = list.filter((a) => a.status === 'diff');
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      list = list.filter((a) => a.accountNumber.toLowerCase().includes(q) || a.accountName.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const catDiff = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
      if (catDiff !== 0) return catDiff;
      return a.accountNumber.localeCompare(b.accountNumber, undefined, { numeric: true });
    });
  }, [accounts, viewMode, searchFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Array<{ category: string; label: string; rows: PyComparisonAccount[]; subtotalRolled: number; subtotalUploaded: number; subtotalVariance: number; subtotalTrueUp: number; subtotalRemaining: number }> = [];
    let current: typeof groups[0] | null = null;
    for (const a of filtered) {
      if (!current || current.category !== a.category) {
        current = { category: a.category, label: CATEGORY_LABELS[a.category] ?? a.category, rows: [], subtotalRolled: 0, subtotalUploaded: 0, subtotalVariance: 0, subtotalTrueUp: 0, subtotalRemaining: 0 };
        groups.push(current);
      }
      current.rows.push(a);
      current.subtotalRolled += netBalance(a.rolledPyDebit, a.rolledPyCredit);
      current.subtotalUploaded += netBalance(a.uploadedPyDebit, a.uploadedPyCredit);
      current.subtotalVariance += (a.varianceDebit - a.varianceCredit);
      current.subtotalTrueUp += netBalance(a.trueUpDebit ?? 0, a.trueUpCredit ?? 0);
      current.subtotalRemaining += a.remainingVarianceCents ?? 0;
    }
    return groups;
  }, [filtered]);

  const varianceIds = accounts.filter((a) => a.status === 'diff').map((a) => a.accountId);
  const allVariancesSelected = varianceIds.length > 0 && varianceIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allVariancesSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(varianceIds));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const colCount = showTrueUp ? 10 : 8;

  // Grand totals across all filtered accounts
  const totalRolled = filtered.reduce((s, a) => s + netBalance(a.rolledPyDebit, a.rolledPyCredit), 0);
  const totalUploaded = filtered.reduce((s, a) => s + netBalance(a.uploadedPyDebit, a.uploadedPyCredit), 0);
  const totalVariance = filtered.reduce((s, a) => s + (a.varianceDebit - a.varianceCredit), 0);
  const totalTrueUp = filtered.reduce((s, a) => s + netBalance(a.trueUpDebit ?? 0, a.trueUpCredit ?? 0), 0);
  const totalRemaining = filtered.reduce((s, a) => s + (a.remainingVarianceCents ?? 0), 0);

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
        <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <th className="px-2 py-2 w-8">
            <input
              type="checkbox"
              checked={allVariancesSelected}
              onChange={toggleSelectAll}
              disabled={varianceIds.length === 0}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
              title="Select all variances"
            />
          </th>
          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-16">Status</th>
          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Acct #</th>
          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Account Name</th>
          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-16">Cat.</th>
          <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Rolled PY</th>
          <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Uploaded PY</th>
          <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Variance</th>
          {showTrueUp && (
            <>
              <th title="Net effect of the tagged PY true-up entries on this account" className="px-2 py-2 text-right text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase">True-up</th>
              <th title="Uploaded + true-up, against the rolled prior year. Blank means this account ties." className="px-2 py-2 text-right text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase">Remaining</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {grouped.map((group) => (
          <GroupRows
            key={group.category}
            group={group}
            selectedIds={selectedIds}
            onToggle={toggleOne}
            colCount={colCount}
            showTrueUp={showTrueUp}
          />
        ))}
        {filtered.length === 0 && (
          <tr>
            <td colSpan={colCount} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
              {viewMode === 'variances' ? 'No variances found.' : 'No accounts to display.'}
            </td>
          </tr>
        )}
      </tbody>
      {filtered.length > 0 && (
        <tfoot className="sticky bottom-0 z-10">
          <tr className="border-t-2 border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 font-semibold">
            <td colSpan={5} className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
              Totals
            </td>
            <td className={`px-2 py-2 text-right font-mono tabular-nums text-sm ${totalRolled < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {fmtNet(totalRolled)}
            </td>
            <td className={`px-2 py-2 text-right font-mono tabular-nums text-sm ${totalUploaded < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {fmtNet(totalUploaded)}
            </td>
            <td className={`px-2 py-2 text-right font-mono tabular-nums text-sm font-bold ${
              totalVariance === 0 ? 'text-gray-300 dark:text-gray-600' : totalVariance < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
            }`}>
              {fmtNet(totalVariance)}
            </td>
            {showTrueUp && (
              <>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-sm text-indigo-700 dark:text-indigo-300">{fmtNet(totalTrueUp)}</td>
                <td className={`px-2 py-2 text-right font-mono tabular-nums text-sm font-bold ${
                  totalRemaining === 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {totalRemaining === 0 ? 'ties' : fmtNet(totalRemaining)}
                </td>
              </>
            )}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function GroupRows({ group, selectedIds, onToggle, colCount, showTrueUp }: {
  group: { category: string; label: string; rows: PyComparisonAccount[]; subtotalRolled: number; subtotalUploaded: number; subtotalVariance: number; subtotalTrueUp: number; subtotalRemaining: number };
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  colCount: number;
  showTrueUp: boolean;
}) {
  return (
    <>
      {/* Category header */}
      <tr className="bg-gray-100 dark:bg-gray-700/50">
        <td colSpan={colCount} className="px-2 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          {group.label}
        </td>
      </tr>
      {/* Account rows */}
      {group.rows.map((a, i) => {
        const rolledNet = netBalance(a.rolledPyDebit, a.rolledPyCredit);
        const uploadedNet = netBalance(a.uploadedPyDebit, a.uploadedPyCredit);
        const variance = a.varianceDebit - a.varianceCredit;
        const trueUpNet = netBalance(a.trueUpDebit ?? 0, a.trueUpCredit ?? 0);
        const remaining = a.remainingVarianceCents ?? 0;
        const isDiff = a.status === 'diff';
        return (
          <tr
            key={a.accountId}
            className={`${isDiff ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''} ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-700/10'} hover:bg-blue-50/50 dark:hover:bg-blue-900/10`}
          >
            <td className="px-2 py-1.5 text-center">
              {isDiff && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.accountId)}
                  onChange={() => onToggle(a.accountId)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
              )}
            </td>
            <td className="px-2 py-1.5">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                isDiff
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                  : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
              }`}>
                {isDiff ? 'DIFF' : 'OK'}
              </span>
            </td>
            <td className="px-2 py-1.5 font-mono text-xs text-gray-900 dark:text-white">{a.accountNumber}</td>
            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{a.accountName}</td>
            <td className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 capitalize">{a.category.slice(0, 3)}</td>
            <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${rolledNet < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {fmtNet(rolledNet)}
            </td>
            <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${uploadedNet < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {fmtNet(uploadedNet)}
            </td>
            <td className={`px-2 py-1.5 text-right font-mono tabular-nums font-semibold ${
              variance === 0 ? 'text-gray-300 dark:text-gray-600' : variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
            }`}>
              {fmtNet(variance)}
            </td>
            {showTrueUp && (
              <>
                <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${trueUpNet === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-indigo-700 dark:text-indigo-300'}`}>
                  {fmtNet(trueUpNet)}
                </td>
                <td
                  title={remaining === 0 ? 'Uploaded + true-up equals the rolled prior year' : 'Still differs from the rolled prior year after the true-ups'}
                  className={`px-2 py-1.5 text-right font-mono tabular-nums font-semibold ${
                    remaining === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {remaining === 0 ? '✓' : fmtNet(remaining)}
                </td>
              </>
            )}
          </tr>
        );
      })}
      {/* Subtotal row */}
      <tr className="bg-gray-100/80 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-600">
        <td colSpan={5} className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
          {group.label} Subtotal
        </td>
        <td className={`px-2 py-1 text-right font-mono tabular-nums text-xs ${group.subtotalRolled < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {fmtNet(group.subtotalRolled)}
        </td>
        <td className={`px-2 py-1 text-right font-mono tabular-nums text-xs ${group.subtotalUploaded < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {fmtNet(group.subtotalUploaded)}
        </td>
        <td className={`px-2 py-1 text-right font-mono tabular-nums text-xs font-semibold ${
          group.subtotalVariance === 0 ? 'text-gray-400 dark:text-gray-500' : group.subtotalVariance < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
        }`}>
          {fmtNet(group.subtotalVariance)}
        </td>
        {showTrueUp && (
          <>
            <td className="px-2 py-1 text-right font-mono tabular-nums text-xs text-indigo-600 dark:text-indigo-400">{fmtNet(group.subtotalTrueUp)}</td>
            <td className={`px-2 py-1 text-right font-mono tabular-nums text-xs font-semibold ${
              group.subtotalRemaining === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {fmtNet(group.subtotalRemaining)}
            </td>
          </>
        )}
      </tr>
    </>
  );
}
