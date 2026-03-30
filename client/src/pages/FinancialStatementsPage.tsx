import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';
import { downloadXlsx } from '../utils/downloadXlsx';

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

function fmtPct(current: number, prior: number): string {
  if (prior === 0 && current === 0) return '—';
  if (prior === 0) return 'N/A';
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const s = Math.abs(pct).toFixed(1);
  return pct < 0 ? `(${s}%)` : `${s}%`;
}

type ColSet = 'unadjusted' | 'book' | 'tax' | 'prior-year';

/**
 * Financial statement display using category-based sign convention:
 * Revenue: positive when credit balance (cr - dr)
 * Expenses: positive when debit balance (dr - cr)
 * Assets: positive when debit balance (dr - cr)
 * Liabilities: positive when credit balance (cr - dr)
 * Equity: positive when credit balance (cr - dr)
 */
function fsDisplayBalance(row: TBRow, colSet: ColSet): number {
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
  // Debit-normal categories (assets, expenses): dr - cr = positive
  // Credit-normal categories (liabilities, equity, revenue): cr - dr = positive
  const creditNormal = row.category === 'revenue' || row.category === 'liabilities' || row.category === 'equity';
  return creditNormal ? cr - dr : dr - cr;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="bg-gray-100 dark:bg-gray-700">
      <td colSpan={5} className="px-4 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {title}
      </td>
    </tr>
  );
}

function AccountRow({ label, cents, priorCents }: { label: string; cents: number; priorCents?: number }) {
  const changeCents = priorCents !== undefined ? cents - priorCents : undefined;
  const changeStr = changeCents !== undefined && (cents !== 0 || priorCents !== 0)
    ? fmt(changeCents)
    : '—';
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-6 py-1.5 text-sm text-gray-700 dark:text-gray-300">{label}</td>
      <td className="px-4 py-1.5 text-sm text-right font-mono text-gray-700 dark:text-gray-300 w-36">{fmt(cents)}</td>
      <td className="px-4 py-1.5 text-sm text-right font-mono text-gray-700 dark:text-gray-300 w-36">{priorCents !== undefined ? fmt(priorCents) : ''}</td>
      <td className="px-4 py-1.5 text-sm text-right font-mono text-gray-700 dark:text-gray-300 w-32">{priorCents !== undefined ? changeStr : ''}</td>
      <td className="px-4 py-1.5 text-sm text-right font-mono text-gray-700 dark:text-gray-300 w-20">{priorCents !== undefined ? fmtPct(cents, priorCents) : ''}</td>
    </tr>
  );
}

function SubtotalRow({ label, cents, priorCents, indent = false }: { label: string; cents: number; priorCents?: number; indent?: boolean }) {
  const changeCents = priorCents !== undefined ? cents - priorCents : undefined;
  const borderClass = 'border-t border-b-2 border-gray-400 dark:border-gray-500';
  return (
    <tr className="border-t border-gray-300 dark:border-gray-600">
      <td className={`px-4 py-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200 ${indent ? 'pl-6' : ''}`}>{label}</td>
      <td className={`px-4 py-1.5 text-sm text-right font-mono font-semibold text-gray-800 dark:text-gray-200 w-36 ${borderClass}`}>{fmtTotal(cents)}</td>
      <td className={`px-4 py-1.5 text-sm text-right font-mono font-semibold text-gray-800 dark:text-gray-200 w-36 ${priorCents !== undefined ? borderClass : ''}`}>{priorCents !== undefined ? fmtTotal(priorCents) : ''}</td>
      <td className={`px-4 py-1.5 text-sm text-right font-mono font-semibold text-gray-800 dark:text-gray-200 w-32 ${changeCents !== undefined ? borderClass : ''}`}>{changeCents !== undefined ? fmtTotal(changeCents) : ''}</td>
      <td className={`px-4 py-1.5 text-sm text-right font-mono font-semibold text-gray-800 dark:text-gray-200 w-20 ${priorCents !== undefined ? borderClass : ''}`}>{priorCents !== undefined ? fmtPct(cents, priorCents) : ''}</td>
    </tr>
  );
}

function TotalRow({ label, cents, priorCents, double: isDouble = false }: { label: string; cents: number; priorCents?: number; double?: boolean }) {
  const color = cents < 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white';
  const changeCents = priorCents !== undefined ? cents - priorCents : undefined;
  const borderClass = isDouble
    ? 'border-t border-b-4 border-double border-gray-700 dark:border-gray-500'
    : 'border-t border-b-2 border-gray-700 dark:border-gray-500';
  return (
    <tr className="border-t-2 border-gray-700 dark:border-gray-500">
      <td className={`px-4 py-2 text-sm font-bold ${color}`}>{label}</td>
      <td className={`px-4 py-2 text-sm text-right font-mono font-bold w-36 ${color} ${borderClass}`}>{fmtTotal(cents)}</td>
      <td className={`px-4 py-2 text-sm text-right font-mono font-bold w-36 ${color} ${priorCents !== undefined ? borderClass : ''}`}>{priorCents !== undefined ? fmtTotal(priorCents) : ''}</td>
      <td className={`px-4 py-2 text-sm text-right font-mono font-bold w-32 ${color} ${changeCents !== undefined ? borderClass : ''}`}>{changeCents !== undefined ? fmtTotal(changeCents) : ''}</td>
      <td className={`px-4 py-2 text-sm text-right font-mono font-bold w-20 ${color} ${priorCents !== undefined ? borderClass : ''}`}>{priorCents !== undefined ? fmtPct(cents, priorCents) : ''}</td>
    </tr>
  );
}

// ─── Income Statement ─────────────────────────────────────────────────────────

function IncomeStatement({ rows, colSet }: { rows: TBRow[]; colSet: ColSet }) {
  const revenue = rows.filter((r) => r.category === 'revenue').sort((a, b) => a.account_number.localeCompare(b.account_number));
  const expenses = rows.filter((r) => r.category === 'expenses').sort((a, b) => a.account_number.localeCompare(b.account_number));

  // Revenue positive (cr-dr), expenses positive (dr-cr)
  const totalRevenue = revenue.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
  const totalExpenses = expenses.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
  const netIncome = totalRevenue - totalExpenses;

  const pyRevenue = revenue.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0);
  const pyExpenses = expenses.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0);
  const pyNetIncome = pyRevenue - pyExpenses;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400"></th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-36">Current</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-36">Prior Year</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-32">Change</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-20">%</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader title="Revenue" />
          {revenue.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={fsDisplayBalance(r, colSet)} priorCents={fsDisplayBalance(r, 'prior-year')} />
          ))}
          {revenue.length === 0 && (
            <tr><td colSpan={5} className="px-6 py-2 text-sm text-gray-400 italic">No revenue accounts found. Add revenue accounts to the Chart of Accounts page.</td></tr>
          )}
          <SubtotalRow label="Total Revenue" cents={totalRevenue} priorCents={pyRevenue} />

          <tr><td colSpan={5} className="py-1" /></tr>

          <SectionHeader title="Expenses" />
          {expenses.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={fsDisplayBalance(r, colSet)} priorCents={fsDisplayBalance(r, 'prior-year')} />
          ))}
          {expenses.length === 0 && (
            <tr><td colSpan={5} className="px-6 py-2 text-sm text-gray-400 italic">No expense accounts found. Add expense accounts to the Chart of Accounts page.</td></tr>
          )}
          <SubtotalRow label="Total Expenses" cents={totalExpenses} priorCents={pyExpenses} />

          <tr><td colSpan={5} className="py-1" /></tr>
          <TotalRow label={netIncome >= 0 ? 'Net Income' : 'Net Loss'} cents={netIncome} priorCents={pyNetIncome} double />
        </tbody>
      </table>
    </div>
  );
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

function BalanceSheet({ rows, colSet }: { rows: TBRow[]; colSet: ColSet }) {
  const assets = rows.filter((r) => r.category === 'assets').sort((a, b) => a.account_number.localeCompare(b.account_number));
  const liabilities = rows.filter((r) => r.category === 'liabilities').sort((a, b) => a.account_number.localeCompare(b.account_number));
  const equity = rows.filter((r) => r.category === 'equity').sort((a, b) => a.account_number.localeCompare(b.account_number));

  const revenue = rows.filter((r) => r.category === 'revenue');
  const expenses = rows.filter((r) => r.category === 'expenses');
  const netIncome = revenue.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0)
                  - expenses.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
  const pyNetIncome = revenue.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0)
                    - expenses.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0);

  const totalAssets = assets.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
  const totalEquity = equity.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0) + netIncome;
  const totalLE = totalLiabilities + totalEquity;
  const balanced = totalAssets === totalLE;

  const pyTotalAssets = assets.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0);
  const pyTotalLiabilities = liabilities.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0);
  const pyTotalEquity = equity.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0) + pyNetIncome;
  const pyTotalLE = pyTotalLiabilities + pyTotalEquity;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400"></th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-36">Current</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-36">Prior Year</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-32">Change</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-20">%</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader title="Assets" />
          {assets.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={fsDisplayBalance(r, colSet)} priorCents={fsDisplayBalance(r, 'prior-year')} />
          ))}
          {assets.length === 0 && (
            <tr><td colSpan={5} className="px-6 py-2 text-sm text-gray-400 italic">No asset accounts found. Add asset accounts to the Chart of Accounts page.</td></tr>
          )}
          <TotalRow label="Total Assets" cents={totalAssets} priorCents={pyTotalAssets} double />

          <tr><td colSpan={5} className="py-2" /></tr>

          <SectionHeader title="Liabilities" />
          {liabilities.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={fsDisplayBalance(r, colSet)} priorCents={fsDisplayBalance(r, 'prior-year')} />
          ))}
          {liabilities.length === 0 && (
            <tr><td colSpan={5} className="px-6 py-2 text-sm text-gray-400 italic">No liability accounts found. Add liability accounts to the Chart of Accounts page.</td></tr>
          )}
          <SubtotalRow label="Total Liabilities" cents={totalLiabilities} priorCents={pyTotalLiabilities} />

          <tr><td colSpan={5} className="py-1" /></tr>

          <SectionHeader title="Equity" />
          {equity.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={fsDisplayBalance(r, colSet)} priorCents={fsDisplayBalance(r, 'prior-year')} />
          ))}
          {equity.length === 0 && (
            <tr><td colSpan={5} className="px-6 py-2 text-sm text-gray-400 italic">No equity accounts found. Add equity accounts to the Chart of Accounts page.</td></tr>
          )}
          <AccountRow label="Net Income (current period)" cents={netIncome} priorCents={pyNetIncome} />
          <SubtotalRow label="Total Equity" cents={totalEquity} priorCents={pyTotalEquity} />

          <tr><td colSpan={5} className="py-1" /></tr>
          <TotalRow label="Total Liabilities + Equity" cents={totalLE} priorCents={pyTotalLE} double />

          {!balanced && (
            <tr className="bg-red-50 dark:bg-red-900/30">
              <td colSpan={5} className="px-4 py-2 text-xs text-red-700 dark:text-red-400 font-medium">
                ⚠ Balance sheet is out of balance by {fmtTotal(Math.abs(totalAssets - totalLE))}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Statement of Equity ──────────────────────────────────────────────────────

function EquityStatement({ rows, colSet }: { rows: TBRow[]; colSet: ColSet }) {
  const equity = rows.filter((r) => r.category === 'equity').sort((a, b) => a.account_number.localeCompare(b.account_number));
  const revenue = rows.filter((r) => r.category === 'revenue');
  const expenses = rows.filter((r) => r.category === 'expenses');

  const netIncome = revenue.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0)
                  - expenses.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
  const pyNetIncome = revenue.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0)
                    - expenses.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0);

  const openingEquity = equity.reduce((s, r) => s + fsDisplayBalance(r, 'prior-year'), 0);
  const closingEquity = equity.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0) + netIncome;
  const pyClosing = openingEquity + pyNetIncome;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400"></th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-36">Current</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-36">Prior Year</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-32">Change</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 w-20">%</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader title="Opening Equity Balance (Prior Year)" />
          {equity.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={fsDisplayBalance(r, 'prior-year')} priorCents={undefined} />
          ))}
          <SubtotalRow label="Total Opening Equity" cents={openingEquity} />

          <tr><td colSpan={5} className="py-1" /></tr>

          <SectionHeader title="Current Period Activity" />
          <AccountRow label="Net Income / (Loss)" cents={netIncome} priorCents={pyNetIncome} />

          <tr><td colSpan={5} className="py-1" /></tr>

          <SectionHeader title="Ending Equity Balance" />
          {equity.map((r) => (
            <AccountRow key={r.account_id} label={`${r.account_number} – ${r.account_name}`} cents={fsDisplayBalance(r, colSet)} priorCents={fsDisplayBalance(r, 'prior-year')} />
          ))}
          <AccountRow label="Net Income (current period)" cents={netIncome} priorCents={pyNetIncome} />
          <TotalRow label="Total Equity" cents={closingEquity} priorCents={pyClosing} double />
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const COL_LABELS: Record<string, string> = {
  unadjusted: 'Unadjusted',
  book: 'Book Adjusted',
  tax: 'Tax Adjusted',
};

export function FinancialStatementsPage() {
  const { selectedPeriodId, selectedClientId } = useUIStore();
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<'income' | 'balance' | 'equity'>('income');
  const [colSet, setColSet] = useState<ColSet>('book');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePreview = async (reportUrl: string) => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await openPdfPreview(reportUrl + '?preview=true', token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownload = async (reportUrl: string, filename: string) => {
    if (!selectedPeriodId || !token) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      await downloadPdf(reportUrl, filename, token);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

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

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => { const r = await listClients(); return r.data ?? []; },
  });

  const { data: periods, isLoading: periodsLoading } = useQuery({
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
    const totalRev = revenue.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
    const totalExp = expenses.reduce((s, r) => s + fsDisplayBalance(r, colSet), 0);
    const netIncome = totalRev - totalExp;

    const header = ['Statement', 'Account Number', 'Account Name', 'Category', `${COL_LABELS[colSet] ?? colSet} Net`];
    const dataRows: string[][] = rows
      .sort((a, b) => {
        const catOrder = ['assets','liabilities','equity','revenue','expenses'];
        const ci = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
        return ci !== 0 ? ci : a.account_number.localeCompare(b.account_number);
      })
      .map((r) => {
        const isIS = r.category === 'revenue' || r.category === 'expenses';
        const stmt = isIS ? 'Income Statement' : 'Balance Sheet';
        const amt = fsDisplayBalance(r, colSet);
        return [stmt, r.account_number, r.account_name, r.category, String(amt / 100)];
      });
    dataRows.push(['Income Statement', '', 'Net Income', '', String(netIncome / 100)]);
    downloadXlsx(`financial-statements-${colSet}.xlsx`, [header, ...dataRows]);
  };

  if (!selectedPeriodId || !selectedClientId) {
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
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Financial Statements</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">View</label>
          <select
            value={colSet}
            onChange={(e) => setColSet(e.target.value as ColSet)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="unadjusted">Unadjusted</option>
            <option value="book">Book Adjusted</option>
            <option value="tax">Tax Adjusted</option>
          </select>
          <button
            onClick={handleExport}
            disabled={!rows.length}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-40"
          >
            Export Excel
          </button>
          {tab === 'income' && selectedPeriodId && (
            <>
              <button
                onClick={() => handlePreview(pdfReports.incomeStatement(selectedPeriodId))}
                disabled={pdfLoading}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
              >
                {pdfLoading ? 'Generating…' : '↗ Preview PDF'}
              </button>
              <button
                onClick={() => handleDownload(pdfReports.incomeStatement(selectedPeriodId), `income-statement-${selectedPeriodId}.pdf`)}
                disabled={pdfLoading}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {pdfLoading ? 'Generating…' : '⬇ Download PDF'}
              </button>
            </>
          )}
          {tab === 'balance' && selectedPeriodId && (
            <>
              <button
                onClick={() => handlePreview(pdfReports.balanceSheet(selectedPeriodId))}
                disabled={pdfLoading}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
              >
                {pdfLoading ? 'Generating…' : '↗ Preview PDF'}
              </button>
              <button
                onClick={() => handleDownload(pdfReports.balanceSheet(selectedPeriodId), `balance-sheet-${selectedPeriodId}.pdf`)}
                disabled={pdfLoading}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {pdfLoading ? 'Generating…' : '⬇ Download PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {pdfError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded mt-2 mb-2">
          {pdfError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        {(['income', 'balance', 'equity'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t === 'income' ? 'Income Statement' : t === 'balance' ? 'Balance Sheet' : 'Statement of Equity'}
          </button>
        ))}
      </div>

      {/* Report header */}
      {(clientsLoading || periodsLoading) ? (
        <div className="animate-pulse space-y-2 mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
      ) : client ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3 mb-4 text-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-base">{client.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{client.entity_type}{client.tax_id ? ` · EIN: ${client.tax_id}` : ''}</p>
            </div>
            {period && (
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                <p className="font-medium text-gray-700 dark:text-gray-300">{period.period_name}</p>
                {period.start_date && period.end_date && (
                  <p>{period.start_date.slice(0, 10)} – {period.end_date.slice(0, 10)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : tab === 'income' ? (
        <IncomeStatement rows={rows} colSet={colSet} />
      ) : tab === 'balance' ? (
        <BalanceSheet rows={rows} colSet={colSet} />
      ) : (
        <EquityStatement rows={rows} colSet={colSet} />
      )}
    </div>
  );
}
