import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import { listTaxCodes, type TaxCode } from '../api/taxCodes';
import { openPdfPreview, downloadPdf, pdfReports } from '../api/pdfReports';

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

export function TaxBasisPlPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const token = useAuthStore((s) => s.token) ?? '';

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

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
    queryKey: ['tax-codes', { clientId: selectedClientId }],
    queryFn: () => listTaxCodes(),
    enabled: !!selectedClientId,
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

    // Iterate over COA accounts (not TB rows) so accounts without TB entries still appear
    const plAccounts = accounts.filter(
      (a) => a.is_active && (a.category === 'revenue' || a.category === 'expenses'),
    );

    // Group by tax_code_id
    const groupMap = new Map<number | null, TaxGroup>();

    for (const account of plAccounts) {
      const tbRow = tbMap.get(account.id);
      const tcId = account.tax_code_id;
      const tc = tcId !== null ? taxCodeMap.get(tcId) : undefined;

      // Build a full TBRow — use real data if available, otherwise zero balances
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
  }, [tbRows, coaAccounts, tcData, selectedPeriodId]);

  // Net Income = total revenue - total expenses (both displayed as positive)
  const grandRevenue = groups.reduce((s, g) => s + g.rows.filter((r) => r.category === 'revenue').reduce((a, r) => a + taxNet(r), 0), 0);
  const grandExpenses = groups.reduce((s, g) => s + g.rows.filter((r) => r.category === 'expenses').reduce((a, r) => a + taxNet(r), 0), 0);
  const grandNet = grandRevenue - grandExpenses;

  const handlePreview = async () => {
    if (!selectedPeriodId) return;
    setPdfLoading(true); setPdfError(null);
    try { await openPdfPreview(pdfReports.taxBasisPl(selectedPeriodId), token); }
    catch (e) { setPdfError((e as Error).message); }
    finally { setPdfLoading(false); }
  };
  const handleDownload = async () => {
    if (!selectedPeriodId) return;
    setPdfLoading(true); setPdfError(null);
    try { await downloadPdf(pdfReports.taxBasisPl(selectedPeriodId), `tax-basis-pl-${selectedPeriodId}.pdf`, token); }
    catch (e) { setPdfError((e as Error).message); }
    finally { setPdfLoading(false); }
  };

  if (!selectedClientId) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Select a client to view the Tax-Basis P&L.</div>;
  }
  if (!selectedPeriodId) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Select a period to view the Tax-Basis P&L.</div>;
  }

  const isLoading = tbLoading || coaLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tax-Basis Profit & Loss</h1>
            {client && period && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{client.name} — {period.period_name}</p>
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
        {pdfError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">PDF error: {pdfError}</p>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            No income or expense accounts found. Assign tax codes in Tax Mapping to group results.
          </div>
        ) : (
          <div className="px-6 py-4">
          <table className="w-full max-w-3xl text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-28">Tax Code</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-24">Acct #</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Account Name</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-400 w-32">Tax-Adj Net</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((grp) => (
                <>
                  {/* Group header */}
                  <tr key={`hdr-${grp.taxCode}`} className="bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
                    <td colSpan={3} className="px-3 py-1.5 font-semibold text-gray-700 dark:text-gray-300 text-xs">
                      <span className="font-mono">{grp.taxCode}</span>
                      <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">— {grp.description}</span>
                    </td>
                    <td className="px-3 py-1.5" />
                  </tr>
                  {/* Account rows */}
                  {grp.rows.map((r, i) => (
                    <tr key={r.account_id} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}>
                      <td className="px-3 py-1.5 text-xs font-mono text-gray-400 dark:text-gray-500">{grp.taxCode === 'Unassigned' ? '—' : grp.taxCode}</td>
                      <td className="px-3 py-1.5 text-sm font-mono text-gray-600 dark:text-gray-400">{r.account_number}</td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-200">{r.account_name}</td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums text-sm ${taxNet(r) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-200'}`}>
                        {fmt(taxNet(r))}
                      </td>
                    </tr>
                  ))}
                  {/* Group subtotal */}
                  <tr key={`sub-${grp.taxCode}`} className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-300 dark:border-gray-600">
                    <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 text-right pr-4">
                      Total {grp.taxCode}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-sm ${grp.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {fmt(grp.net)}
                    </td>
                  </tr>
                </>
              ))}
              {/* Net Income */}
              <tr className="border-t-2 border-gray-400 dark:border-gray-500 bg-blue-50 dark:bg-blue-900/20">
                <td colSpan={3} className="px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 text-right pr-4">
                  Net Income (Loss)
                </td>
                <td className={`px-3 py-2 text-right text-sm font-mono font-bold tabular-nums ${grandNet < 0 ? 'text-red-700 dark:text-red-400' : grandNet > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
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
