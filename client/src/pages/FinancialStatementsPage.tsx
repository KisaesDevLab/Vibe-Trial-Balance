import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';
import { useUIStore } from '../store/uiStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  if (cents === 0) return '—';
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

function fmtTotal(cents: number): string {
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

type ColSet = 'unadjusted' | 'book' | 'tax' | 'prior-year';

function netBalance(row: TBRow, colSet: ColSet): number {
  let dr: number, cr: number;
  if (colSet === 'unadjusted') {
    dr = row.unadjusted_debit; cr = row.unadjusted_credit;
  } else if (colSet === 'book') {
    dr = row.book_adjusted_debit; cr = row.book_adjusted_credit;
  } else if (colSet === 'tax') {
    dr = row.tax_adjusted_debit; cr = row.tax_adjusted_credit;
  } else {
    dr = row.prior_year_debit; cr = row.prior_year_credit;
  }
  return row.normal_balance === 'debit' ? dr - cr : cr - dr;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={2} className="px-4 py-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
        {title}
      </td>
    </tr>
  );
}

function AccountRow({ label, cents }: { label: string; cents: number }) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-6 py-1.5 text-sm text-gray-700">{label}</td>
      <td className="px-4 py-1.5 text-sm text-right font-mono text-gray-700 w-36">{fmt(cents)}</td>
    </tr>
  );
}

function SubtotalRow({ label, cents, indent = false }: { label: string; cents: number; indent?: boolean }) {
  return (
    <tr className="border-t border-gray-300">
      <td className={`px-4 py-1.5 text-sm font-semibold text-gray-800 ${indent ? 'pl-6' : ''}`}>{label}</td>
      <td className="px-4 py-1.5 text-sm text-right font-mono font-semibold text-gray-800 w-36 border-t border-gray-400">
        {fmtTotal(cents)}
      </td>
    </tr>
  );
}

function TotalRow({ label, cents, double = false }: { label: string; cents: number; double?: boolean }) {
  const color = cents < 0 ? 'text-red-700' : 'text-gray-900';
  return (
    <tr className="border-t-2 border-gray-700">
      <td className={`px-4 py-2 text-sm font-bold ${color}`}>{label}</td>
      <td className={`px-4 py-2 text-sm text-right font-mono font-bold w-36 ${color} ${double ? 'border-b-4 border-double border-gray-700' : 'border-b-2 border-gray-700'}`}>
        {fmtTotal(cents)}
      </td>
    </tr>
  );
}

// ─── Income Statement ─────────────────────────────────────────────────────────

function IncomeStatement({ rows, colSet }: { rows: TBRow[]; colSet: ColSet }) {
  const revenue = rows.filter((r) => r.category === 'revenue').sort((a, b) => a.sort_order - b.sort_order);
  const expenses = rows.filter((r) => r.category === 'expenses').sort((a, b) => a.sort_order - b.sort_order);

  const totalRevenue = revenue.reduce((s, r) => s + netBalance(r, colSet), 0);
  const totalExpenses = expenses.reduce((s, r) => s + netBalance(r, colSet), 0);
  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <tbody>
          <SectionHeader title="Revenue" />
          {revenue.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={netBalance(r, colSet)} />
          ))}
          {revenue.length === 0 && (
            <tr><td colSpan={2} className="px-6 py-2 text-sm text-gray-400 italic">No revenue accounts</td></tr>
          )}
          <SubtotalRow label="Total Revenue" cents={totalRevenue} />

          <tr><td colSpan={2} className="py-1" /></tr>

          <SectionHeader title="Expenses" />
          {expenses.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={netBalance(r, colSet)} />
          ))}
          {expenses.length === 0 && (
            <tr><td colSpan={2} className="px-6 py-2 text-sm text-gray-400 italic">No expense accounts</td></tr>
          )}
          <SubtotalRow label="Total Expenses" cents={totalExpenses} />

          <tr><td colSpan={2} className="py-1" /></tr>
          <TotalRow label={netIncome >= 0 ? 'Net Income' : 'Net Loss'} cents={netIncome} double />
        </tbody>
      </table>
    </div>
  );
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

function BalanceSheet({ rows, colSet }: { rows: TBRow[]; colSet: ColSet }) {
  const assets = rows.filter((r) => r.category === 'assets').sort((a, b) => a.sort_order - b.sort_order);
  const liabilities = rows.filter((r) => r.category === 'liabilities').sort((a, b) => a.sort_order - b.sort_order);
  const equity = rows.filter((r) => r.category === 'equity').sort((a, b) => a.sort_order - b.sort_order);

  const revenue = rows.filter((r) => r.category === 'revenue');
  const expenses = rows.filter((r) => r.category === 'expenses');
  const netIncome = revenue.reduce((s, r) => s + netBalance(r, colSet), 0)
                  - expenses.reduce((s, r) => s + netBalance(r, colSet), 0);

  const totalAssets = assets.reduce((s, r) => s + netBalance(r, colSet), 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + netBalance(r, colSet), 0);
  const totalEquity = equity.reduce((s, r) => s + netBalance(r, colSet), 0) + netIncome;
  const totalLE = totalLiabilities + totalEquity;
  const balanced = totalAssets === totalLE;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <tbody>
          <SectionHeader title="Assets" />
          {assets.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={netBalance(r, colSet)} />
          ))}
          {assets.length === 0 && (
            <tr><td colSpan={2} className="px-6 py-2 text-sm text-gray-400 italic">No asset accounts</td></tr>
          )}
          <TotalRow label="Total Assets" cents={totalAssets} double />

          <tr><td colSpan={2} className="py-2" /></tr>

          <SectionHeader title="Liabilities" />
          {liabilities.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={netBalance(r, colSet)} />
          ))}
          {liabilities.length === 0 && (
            <tr><td colSpan={2} className="px-6 py-2 text-sm text-gray-400 italic">No liability accounts</td></tr>
          )}
          <SubtotalRow label="Total Liabilities" cents={totalLiabilities} />

          <tr><td colSpan={2} className="py-1" /></tr>

          <SectionHeader title="Equity" />
          {equity.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={netBalance(r, colSet)} />
          ))}
          {equity.length === 0 && (
            <tr><td colSpan={2} className="px-6 py-2 text-sm text-gray-400 italic">No equity accounts</td></tr>
          )}
          <AccountRow label="Net Income (current period)" cents={netIncome} />
          <SubtotalRow label="Total Equity" cents={totalEquity} />

          <tr><td colSpan={2} className="py-1" /></tr>
          <TotalRow label="Total Liabilities + Equity" cents={totalLE} double />

          {!balanced && (
            <tr className="bg-red-50">
              <td colSpan={2} className="px-4 py-2 text-xs text-red-700 font-medium">
                ⚠ Balance sheet is out of balance by {fmtTotal(Math.abs(totalAssets - totalLE))}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const COL_LABELS: Record<ColSet, string> = {
  unadjusted: 'Unadjusted',
  book: 'Book Adjusted',
  tax: 'Tax Adjusted',
  'prior-year': 'Prior Year',
};

export function FinancialStatementsPage() {
  const { selectedPeriodId, selectedClientId } = useUIStore();
  const [tab, setTab] = useState<'income' | 'balance'>('income');
  const [colSet, setColSet] = useState<ColSet>('book');

  const { data, isLoading, error } = useQuery({
    queryKey: ['trial-balance', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const res = await getTrialBalance(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: selectedPeriodId !== null,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => { const r = await listClients(); return r.data ?? []; },
  });

  const { data: periods } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => { const r = await listPeriods(selectedClientId!); return r.data ?? []; },
    enabled: selectedClientId !== null,
  });

  const client = clients?.find((c) => c.id === selectedClientId);
  const period = periods?.find((p) => p.id === selectedPeriodId);

  const rows = (data ?? []).filter((r) => r.is_active);

  const handleExport = () => {
    if (!rows.length) return;
    const revenue = rows.filter((r) => r.category === 'revenue');
    const expenses = rows.filter((r) => r.category === 'expenses');
    const netIncome = revenue.reduce((s, r) => s + netBalance(r, colSet), 0)
                    - expenses.reduce((s, r) => s + netBalance(r, colSet), 0);

    const header = ['Statement', 'Account Number', 'Account Name', 'Category', `${COL_LABELS[colSet]} Net`];
    const dataRows: string[][] = rows
      .sort((a, b) => {
        const catOrder = ['assets','liabilities','equity','revenue','expenses'];
        const ci = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
        return ci !== 0 ? ci : a.sort_order - b.sort_order;
      })
      .map((r) => {
        const stmt = (r.category === 'revenue' || r.category === 'expenses') ? 'Income Statement' : 'Balance Sheet';
        return [stmt, r.account_number, r.account_name, r.category, String(netBalance(r, colSet) / 100)];
      });
    dataRows.push(['Income Statement', '', 'Net Income', '', String(netIncome / 100)]);
    downloadCsv(`financial-statements-${colSet}.csv`, [header, ...dataRows]);
  };

  if (!selectedPeriodId || !selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No period selected</p>
          <p className="text-sm mt-1">Choose a client and period from the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Financial Statements</h2>
        <div className="flex items-center gap-2">
          <select
            value={colSet}
            onChange={(e) => setColSet(e.target.value as ColSet)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="prior-year">Prior Year</option>
            <option value="unadjusted">Unadjusted</option>
            <option value="book">Book Adjusted</option>
            <option value="tax">Tax Adjusted</option>
          </select>
          <button
            onClick={handleExport}
            disabled={!rows.length}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['income', 'balance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'income' ? 'Income Statement' : 'Balance Sheet'}
          </button>
        ))}
      </div>

      {/* Report header */}
      {client && (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-3 mb-4 text-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-base">{client.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{client.entity_type}{client.tax_id ? ` · EIN: ${client.tax_id}` : ''}</p>
            </div>
            {period && (
              <div className="text-right text-xs text-gray-500">
                <p className="font-medium text-gray-700">{period.period_name}</p>
                {period.start_date && period.end_date && (
                  <p>{period.start_date} – {period.end_date}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : tab === 'income' ? (
        <IncomeStatement rows={rows} colSet={colSet} />
      ) : (
        <BalanceSheet rows={rows} colSet={colSet} />
      )}
    </div>
  );
}
