import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { listClients, type Client } from '../api/clients';
import { listPeriods, type Period } from '../api/periods';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listAccounts, updateAccount, type Account } from '../api/chartOfAccounts';
import { getAvailableTaxCodes, type TaxCode } from '../api/taxCodes';

// ---- Types ----

type FilterMode = 'all' | 'unmapped' | 'mapped';

type AccountCategory = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';

interface MappingRow {
  account: Account;
  tb?: TBRow;
  taxCodeId: number | null;
  taxLine: string | null;
  taxLineSource: string | null;
}

// ---- Constants ----

const CATEGORY_ORDER: AccountCategory[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

const CATEGORY_LABELS: Record<AccountCategory, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expenses: 'Expenses',
};

const SOURCE_CLASSES: Record<string, string> = {
  manual: 'bg-gray-100 text-gray-600',
  ai: 'bg-blue-50 text-blue-700',
  pattern: 'bg-purple-50 text-purple-700',
  prior_year: 'bg-green-50 text-green-700',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  ai: 'AI',
  pattern: 'Pattern',
  prior_year: 'Prior Year',
};

const ENTITY_BADGE: Record<string, string> = {
  '1040_C': 'bg-blue-50 text-blue-700',
  '1065': 'bg-purple-50 text-purple-700',
  '1120': 'bg-amber-50 text-amber-700',
  '1120S': 'bg-green-50 text-green-700',
};

// ---- Helpers ----

function fmtCents(cents: number): string {
  if (cents === 0) return '—';
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${formatted})` : formatted;
}

function netBalance(row: TBRow): number {
  // tax-adjusted net: use tax_adjusted if available, otherwise book_adjusted
  const debit = row.tax_adjusted_debit || row.book_adjusted_debit || row.unadjusted_debit;
  const credit = row.tax_adjusted_credit || row.book_adjusted_credit || row.unadjusted_credit;
  return debit - credit;
}

function accountNetBalance(account: Account, tbMap: Map<number, TBRow>): number {
  const tb = tbMap.get(account.id);
  if (!tb) return 0;
  return netBalance(tb);
}

// ---- Tax Code Dropdown ----

interface TaxCodeDropdownProps {
  accountId: number;
  currentCodeId: number | null;
  taxCodes: TaxCode[];
  onSelect: (codeId: number | null, taxLine: string | null) => void;
  disabled?: boolean;
}

function TaxCodeDropdown({ accountId: _accountId, currentCodeId, taxCodes, onSelect, disabled }: TaxCodeDropdownProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = taxCodes.find((c) => c.id === currentCodeId);

  const filtered = taxCodes.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.tax_code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  const selectCode = (code: TaxCode | null) => {
    onSelect(code?.id ?? null, code?.tax_code ?? null);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300 hover:border-blue-400'
        } ${currentCodeId ? '' : 'text-gray-400 italic'}`}
      >
        {current
          ? <span><span className="font-mono font-medium text-gray-900">{current.sort_order}: {current.tax_code}</span> — {current.description}</span>
          : <span>— unassigned —</span>}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or description…"
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => selectCode(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 italic hover:bg-gray-50 border-b"
            >
              — unassigned —
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No matching codes</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCode(c)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${currentCodeId === c.id ? 'bg-blue-50 font-medium' : ''}`}
                >
                  <span className="font-mono font-medium text-gray-900">{c.sort_order}: {c.tax_code}</span>
                  <span className="text-gray-500 ml-1">— {c.description}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

export function TaxMappingPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const qc = useQueryClient();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());

  // Data fetches
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await listClients();
      return res.data ?? [];
    },
  });

  const { data: periodsData } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await listPeriods(selectedClientId);
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['chart-of-accounts', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await listAccounts(selectedClientId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });

  const { data: tbData, isLoading: tbLoading } = useQuery({
    queryKey: ['trial-balance', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const res = await getTrialBalance(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
    enabled: selectedPeriodId !== null,
  });

  const { data: taxCodesData } = useQuery({
    queryKey: ['tax-codes-available', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await getAvailableTaxCodes(selectedClientId);
      if (res.error) return [];
      return res.data ?? [];
    },
    enabled: selectedClientId !== null,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, taxCodeId }: { id: number; taxCodeId: number | null }) =>
      updateAccount(id, { taxCodeId }),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
      // Flash the row
      setFlashIds((prev) => new Set(prev).add(variables.id));
      setTimeout(() => {
        setFlashIds((prev) => {
          const next = new Set(prev);
          next.delete(variables.id);
          return next;
        });
      }, 1200);
    },
  });

  // Build lookup maps
  const selectedClient = (clientsData ?? []).find((c: Client) => c.id === selectedClientId);
  const selectedPeriod = (periodsData ?? []).find((p: Period) => p.id === selectedPeriodId);

  const tbMap = new Map<number, TBRow>((tbData ?? []).map((r) => [r.account_id, r]));
  const accounts = (accountsData ?? []).filter((a: Account) => a.is_active);
  const taxCodes = taxCodesData ?? [];

  // Build mapping rows
  const mappingRows: MappingRow[] = accounts.map((account: Account) => ({
    account,
    tb: tbMap.get(account.id),
    taxCodeId: (account as Account & { tax_code_id?: number | null }).tax_code_id ?? null,
    taxLine: account.tax_line,
    taxLineSource: (account as Account & { tax_line_source?: string | null }).tax_line_source ?? null,
  }));

  // Progress
  const totalAccounts = mappingRows.length;
  const mappedAccounts = mappingRows.filter((r) => r.taxCodeId !== null || r.taxLine !== null).length;
  const mappedPct = totalAccounts > 0 ? Math.round((mappedAccounts / totalAccounts) * 100) : 0;

  const progressColor = mappedPct >= 80 ? 'bg-green-500' : mappedPct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const progressTextColor = mappedPct >= 80 ? 'text-green-700' : mappedPct >= 40 ? 'text-amber-700' : 'text-red-600';

  // Filtered rows
  const visibleRows = mappingRows.filter((r) => {
    if (filterMode === 'unmapped') return r.taxCodeId === null && r.taxLine === null;
    if (filterMode === 'mapped') return r.taxCodeId !== null || r.taxLine !== null;
    return true;
  });

  // Group by category
  const rowsByCategory = new Map<AccountCategory, MappingRow[]>();
  CATEGORY_ORDER.forEach((cat) => rowsByCategory.set(cat, []));
  visibleRows.forEach((r) => {
    const cat = r.account.category as AccountCategory;
    rowsByCategory.get(cat)?.push(r);
  });

  // Compute category totals (from all accounts, not filtered)
  const totalsByCategory = new Map<AccountCategory, number>();
  CATEGORY_ORDER.forEach((cat) => {
    const catRows = mappingRows.filter((r) => r.account.category === cat);
    const total = catRows.reduce((sum, r) => sum + accountNetBalance(r.account, tbMap), 0);
    totalsByCategory.set(cat, total);
  });

  const revenueTotal = totalsByCategory.get('revenue') ?? 0;
  const expensesTotal = totalsByCategory.get('expenses') ?? 0;
  const netIncome = revenueTotal - expensesTotal;

  const assetsTotal = totalsByCategory.get('assets') ?? 0;
  const liabTotal = totalsByCategory.get('liabilities') ?? 0;
  const equityTotal = totalsByCategory.get('equity') ?? 0;
  const bsBalance = assetsTotal - (liabTotal + equityTotal);
  const bsBalanced = Math.abs(bsBalance) < 1; // within 1 cent

  const isLoading = accountsLoading || tbLoading;

  const handleCodeSelect = (account: Account, codeId: number | null, taxLine: string | null) => {
    // Optimistic update: update query cache directly
    qc.setQueryData<Account[]>(['chart-of-accounts', selectedClientId], (prev) =>
      prev?.map((a) =>
        a.id === account.id
          ? { ...a, tax_code_id: codeId, tax_line: taxLine, tax_line_source: 'manual' as const }
          : a
      )
    );
    updateMutation.mutate({ id: account.id, taxCodeId: codeId });
  };

  // Guards
  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">No client selected</p>
          <p className="text-sm mt-1">Choose a client from the sidebar to use Tax Mapping.</p>
        </div>
      </div>
    );
  }

  if (!selectedPeriodId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">No period selected</p>
          <p className="text-sm mt-1">Choose a period from the sidebar to use Tax Mapping.</p>
        </div>
      </div>
    );
  }

  const COLS = 6;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tax Mapping</h2>
          {selectedClient && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-700 font-medium">{selectedClient.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ENTITY_BADGE[selectedClient.entity_type] ?? 'bg-gray-100 text-gray-600'}`}>
                {selectedClient.entity_type}
              </span>
              {selectedPeriod && (
                <span className="text-xs text-gray-500">{selectedPeriod.period_name}</span>
              )}
            </div>
          )}
        </div>
        <div title="Coming in Phase 11: AI Tax Assignment">
          <button
            disabled
            className="px-3 py-1.5 text-sm border border-gray-200 rounded text-gray-400 cursor-not-allowed"
          >
            Auto-assign (Coming Soon)
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${progressTextColor}`}>
            {mappedAccounts} of {totalAccounts} accounts mapped ({mappedPct}%)
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressColor}`}
            style={{ width: `${mappedPct}%` }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 mb-4">
        {(['all', 'unmapped', 'mapped'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              filterMode === mode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {mode === 'all' ? 'Show All' : mode === 'unmapped' ? 'Unmapped Only' : 'Mapped Only'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Acct #</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Account Name</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Balance</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-72">Tax Code</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Source</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {CATEGORY_ORDER.map((cat) => {
                  const catRows = rowsByCategory.get(cat) ?? [];
                  const catTotal = totalsByCategory.get(cat) ?? 0;
                  const allCatRows = mappingRows.filter((r) => r.account.category === cat);

                  if (allCatRows.length === 0) return null;

                  return [
                    // Category header
                    <tr key={`header-${cat}`} className="bg-gray-100">
                      <td colSpan={COLS} className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {CATEGORY_LABELS[cat]}
                      </td>
                    </tr>,

                    // Account rows
                    ...catRows.map((row) => {
                      const balance = accountNetBalance(row.account, tbMap);
                      const isUnmapped = row.taxCodeId === null && row.taxLine === null;
                      const isFlashing = flashIds.has(row.account.id);
                      const source = row.taxLineSource;

                      return (
                        <tr
                          key={row.account.id}
                          className={`transition-colors ${
                            isFlashing
                              ? 'bg-green-50'
                              : isUnmapped
                              ? 'border-l-2 border-l-amber-400 bg-amber-50/30 hover:bg-amber-50/60'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{row.account.account_number}</td>
                          <td className="px-3 py-2 text-gray-800 font-medium">{row.account.account_name}</td>
                          <td className={`px-3 py-2 text-right font-mono text-xs ${balance < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                            {fmtCents(balance)}
                          </td>
                          <td className="px-3 py-2">
                            <TaxCodeDropdown
                              accountId={row.account.id}
                              currentCodeId={row.taxCodeId}
                              taxCodes={taxCodes}
                              onSelect={(codeId, taxLine) => handleCodeSelect(row.account, codeId, taxLine)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {source ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SOURCE_CLASSES[source] ?? 'bg-gray-100 text-gray-500'}`}>
                                {SOURCE_LABELS[source] ?? source}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {source === 'ai' && row.taxLineSource === 'ai' ? '—' : null}
                          </td>
                        </tr>
                      );
                    }),

                    // Category subtotal
                    <tr key={`subtotal-${cat}`} className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={2} className="px-3 py-2 text-xs font-bold text-gray-700 text-right pr-6">
                        Total {CATEGORY_LABELS[cat]}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${catTotal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {fmtCents(catTotal)}
                      </td>
                      <td colSpan={3} />
                    </tr>,
                  ];
                })}

                {/* Net Income */}
                <tr className="border-t-2 border-gray-300 bg-white">
                  <td colSpan={2} className="px-3 py-2.5 text-sm font-bold text-gray-900 text-right pr-6">
                    Net Income (Loss)
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-sm font-bold ${netIncome < 0 ? 'text-red-600' : netIncome > 0 ? 'text-green-700' : 'text-gray-700'}`}>
                    {fmtCents(netIncome)}
                  </td>
                  <td colSpan={3} />
                </tr>

                {/* Balance Sheet Check */}
                <tr className={`border-t border-gray-200 ${bsBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
                  <td colSpan={2} className="px-3 py-2 text-xs font-bold text-right pr-6">
                    <span className={bsBalanced ? 'text-green-700' : 'text-red-600'}>
                      Assets = Liabilities + Equity
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${bsBalanced ? 'text-green-700' : 'text-red-600'}`}>
                    {bsBalanced
                      ? '✓ Balanced'
                      : `✗ Off by ${fmtCents(Math.abs(bsBalance))}`}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
