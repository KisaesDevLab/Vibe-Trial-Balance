import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { listTaxCodes, type TaxCode } from '../api/taxCodes';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';

const CATEGORY_LABELS: Record<string, string> = {
  assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expenses: 'Expenses',
};

const fmt = (cents: number) => {
  if (cents === 0) return '—';
  const abs = Math.abs(cents) / 100;
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return cents < 0 ? `(${s})` : s;
};

function taxNet(r: TBRow) {
  return r.normal_balance === 'debit'
    ? r.tax_adjusted_debit - r.tax_adjusted_credit
    : r.tax_adjusted_credit - r.tax_adjusted_debit;
}

interface TaxGroup {
  taxCodeId: number | null;
  taxCode: string;
  description: string;
  sortOrder: number;
  rows: (TBRow & { account: Account })[];
  net: number;
}

export function TaxReturnOrderPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const token = useAuthStore((s) => s.token) ?? '';

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: listClients });
  const { data: periodsData } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: () => listPeriods(selectedClientId!),
    enabled: !!selectedClientId,
  });
  const { data: tbRows, isLoading: tbLoading } = useQuery({
    queryKey: ['trial-balance', selectedPeriodId],
    queryFn: async () => {
      const res = await getTrialBalance(selectedPeriodId!);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!selectedPeriodId,
  });
  const { data: coaAccounts, isLoading: coaLoading } = useQuery({
    queryKey: ['chart-of-accounts', selectedClientId],
    queryFn: async () => {
      const res = await listAccounts(selectedClientId!);
      return res.data ?? [];
    },
    enabled: !!selectedClientId,
  });
  const { data: tcData } = useQuery({
    queryKey: ['tax-codes'],
    queryFn: () => listTaxCodes(),
  });

  const client = useMemo(
    () => clientsData?.data?.find((c) => c.id === selectedClientId),
    [clientsData, selectedClientId],
  );
  const period = useMemo(
    () => periodsData?.data?.find((p) => p.id === selectedPeriodId),
    [periodsData, selectedPeriodId],
  );

  const groups = useMemo((): TaxGroup[] => {
    const tbRowList = tbRows ?? [];
    const accounts = coaAccounts ?? [];
    const taxCodes = tcData?.data ?? [];

    // Keyed by account_id for O(1) lookup
    const tbMap = new Map<number, TBRow>(tbRowList.map((r) => [r.account_id, r]));
    const taxCodeMap = new Map<number, TaxCode>(taxCodes.map((tc) => [tc.id, tc]));

    // Iterate over COA accounts so accounts without TB entries still appear
    const filteredAccounts = accounts.filter(
      (a) => a.is_active && (!filterCategory || a.category === filterCategory),
    );

    const groupMap = new Map<number | null, TaxGroup>();
    for (const account of filteredAccounts) {
      const tbRow = tbMap.get(account.id);
      const tcId = account.tax_code_id;
      const tc = tcId !== null ? taxCodeMap.get(tcId) : undefined;

      const r: TBRow = tbRow ?? {
        period_id: selectedPeriodId ?? 0,
        account_id: account.id,
        account_number: account.account_number,
        account_name: account.account_name,
        category: account.category,
        normal_balance: account.normal_balance,
        tax_line: account.tax_line,
        workpaper_ref: account.workpaper_ref,
        unit: account.unit,
        is_active: account.is_active,
        preparer_notes: account.preparer_notes,
        reviewer_notes: account.reviewer_notes,
        unadjusted_debit: 0,
        unadjusted_credit: 0,
        prior_year_debit: 0,
        prior_year_credit: 0,
        trans_adj_debit: 0,
        trans_adj_credit: 0,
        post_trans_debit: 0,
        post_trans_credit: 0,
        book_adj_debit: 0,
        book_adj_credit: 0,
        tax_adj_debit: 0,
        tax_adj_credit: 0,
        book_adjusted_debit: 0,
        book_adjusted_credit: 0,
        tax_adjusted_debit: 0,
        tax_adjusted_credit: 0,
      };

      if (!groupMap.has(tcId)) {
        groupMap.set(tcId, {
          taxCodeId: tcId,
          taxCode: tc?.tax_code ?? 'Unassigned',
          description: tc?.description ?? '(no tax code assigned)',
          sortOrder: tc?.sort_order ?? 99999,
          rows: [],
          net: 0,
        });
      }
      const grp = groupMap.get(tcId)!;
      grp.rows.push({ ...r, account });
      grp.net += taxNet(r);
    }

    return Array.from(groupMap.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.taxCode.localeCompare(b.taxCode));
  }, [tbRows, coaAccounts, tcData, filterCategory, selectedPeriodId]);

  const grandNet = groups.reduce((s, g) => s + g.net, 0);
  const mappedCount = groups.filter((g) => g.taxCodeId !== null).reduce((s, g) => s + g.rows.length, 0);
  const totalCount = groups.reduce((s, g) => s + g.rows.length, 0);

  const handlePreview = async () => {
    if (!selectedPeriodId) return;
    setPdfLoading(true); setPdfError(null);
    try { await openPdfPreview(pdfReports.taxReturnOrder(selectedPeriodId), token); }
    catch (e) { setPdfError((e as Error).message); }
    finally { setPdfLoading(false); }
  };
  const handleDownload = async () => {
    if (!selectedPeriodId) return;
    setPdfLoading(true); setPdfError(null);
    try { await downloadPdf(pdfReports.taxReturnOrder(selectedPeriodId), `tax-return-order-${selectedPeriodId}.pdf`, token); }
    catch (e) { setPdfError((e as Error).message); }
    finally { setPdfLoading(false); }
  };

  if (!selectedClientId) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Select a client to view the Tax Return Order report.</div>;
  }
  if (!selectedPeriodId) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Select a period to view the Tax Return Order report.</div>;
  }

  const isLoading = tbLoading || coaLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tax Return Order</h1>
            {client && period && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {client.name} — {period.period_name}
                {!isLoading && (
                  <span className="ml-2 text-xs">
                    · {mappedCount}/{totalCount} accounts mapped
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={pdfLoading || !groups.length}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
            >
              {pdfLoading ? 'Generating…' : '↗ Preview PDF'}
            </button>
            <button
              onClick={handleDownload}
              disabled={pdfLoading || !groups.length}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {pdfLoading ? 'Generating…' : '⬇ Download PDF'}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {pdfError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">PDF error: {pdfError}</p>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            No accounts found for the selected filters.
          </div>
        ) : (
          <div className="px-6 py-4">
          <table className="w-full max-w-4xl text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 z-10">
              <tr>
                <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-14">Sort</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-28">Tax Code</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-24">Acct #</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Account Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-24">Category</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-32">Tax-Adj Net</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((grp) => (
                <>
                  <tr key={`hdr-${grp.taxCode}`} className="bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-1.5 text-right text-xs font-mono text-gray-400 dark:text-gray-500 tabular-nums">
                      {grp.sortOrder < 99999 ? grp.sortOrder : '—'}
                    </td>
                    <td className="px-3 py-1.5 font-mono font-semibold text-xs text-gray-700 dark:text-gray-300">{grp.taxCode}</td>
                    <td colSpan={3} className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">{grp.description}</td>
                    <td className="px-3 py-1.5" />
                  </tr>
                  {grp.rows.map((r, i) => (
                    <tr key={r.account_id} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                      <td className="px-3 py-1.5 text-right text-sm font-mono text-gray-300 dark:text-gray-600 tabular-nums">
                        {grp.sortOrder < 99999 ? grp.sortOrder : ''}
                      </td>
                      <td className="px-3 py-1.5 text-sm font-mono text-gray-400 dark:text-gray-500">{grp.taxCode === 'Unassigned' ? '—' : grp.taxCode}</td>
                      <td className="px-3 py-1.5 text-sm font-mono text-gray-600 dark:text-gray-400">{r.account_number}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-200">{r.account_name}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 capitalize">{r.category}</td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums text-sm ${taxNet(r) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-200'}`}>
                        {fmt(taxNet(r))}
                      </td>
                    </tr>
                  ))}
                  <tr key={`sub-${grp.taxCode}`} className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-300 dark:border-gray-600">
                    <td colSpan={5} className="px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right pr-4">
                      Total {grp.taxCode}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-sm ${grp.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {fmt(grp.net)}
                    </td>
                  </tr>
                </>
              ))}
              <tr className="border-t-2 border-gray-400 dark:border-gray-500 bg-blue-50 dark:bg-blue-900/20">
                <td colSpan={5} className="px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 text-right pr-4">
                  Grand Total (Net)
                </td>
                <td className={`px-3 py-2 text-right font-mono font-bold tabular-nums ${grandNet < 0 ? 'text-red-700 dark:text-red-400' : grandNet > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {fmt(grandNet)}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
