// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { AiConsentDialog, AI_PII } from '../components/AiConsentDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore, pushToast } from '../store/uiStore';
import { listClients, type Client } from '../api/clients';
import { listPeriods, type Period } from '../api/periods';
import { getTrialBalance, type TBRow } from '../api/trialBalance';
import { listAccounts, updateAccount, type Account } from '../api/chartOfAccounts';
import { getAvailableTaxCodes, type TaxCode } from '../api/taxCodes';
import {
  autoAssignTaxLines,
  bulkConfirmTaxLines,
  type AssignmentSuggestion,
} from '../api/taxLineAssignment';
import { AssignmentPreviewModal } from '../components/AssignmentPreviewModal';
import { categoryNet } from '../lib/accounting';
import { confirmAction } from '../components/ConfirmDialog';

// ---- Types ----

type FilterMode = 'all' | 'unmapped' | 'mapped';

type AccountCategory = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';

interface MappingRow {
  account: Account;
  tb?: TBRow;
  taxCodeId: number | null;
  taxLine: string | null;
  taxLineSource: string | null;
  taxLineConfidence: number | null;
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
  manual: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  ai: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  pattern: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  prior_year: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
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
  // Tax-adjusted net, signed by CATEGORY so contra accounts (accumulated
  // depreciation, sales returns) come out negative and category subtotals,
  // net income, and the balance check all net correctly.
  return categoryNet(row.category, row.tax_adjusted_debit, row.tax_adjusted_credit);
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
  /** tax_line string on the account, shown when the assigned code is not in the available list */
  currentTaxLine?: string | null;
  taxCodes: TaxCode[];
  onSelect: (codeId: number | null, taxLine: string | null) => void;
  disabled?: boolean;
}

function TaxCodeDropdown({ accountId: _accountId, currentCodeId, currentTaxLine, taxCodes, onSelect, disabled }: TaxCodeDropdownProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = taxCodes.find((c) => c.id === currentCodeId);

  const filtered = taxCodes.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.tax_code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  useEffect(() => { setHighlightIndex(-1); }, [search]);

  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const child = listRef.current.children[highlightIndex + 1] as HTMLElement | undefined;
    child?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const selectCode = (code: TaxCode | null) => {
    onSelect(code?.id ?? null, code?.tax_code ?? null);
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((p) => (p < filtered.length - 1 ? p + 1 : 0)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((p) => (p > 0 ? p - 1 : filtered.length - 1)); return; }
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      const idx = highlightIndex >= 0 ? highlightIndex : 0;
      selectCode(filtered[idx]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          disabled ? 'bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-600' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:text-gray-300'
        } ${currentCodeId ? '' : 'text-gray-400 dark:text-gray-500 italic'}`}
      >
        {current
          ? <span><span className="font-mono font-medium text-gray-900 dark:text-white">{current.sort_order}: {current.tax_code}</span> — {current.description}</span>
          : currentCodeId !== null
            // Assigned to a code outside the available list (entity/activity
            // type changed, cross-client assign, inactive code). The account
            // IS mapped — never present it as unassigned.
            ? <span className="not-italic text-amber-700 dark:text-amber-400">{currentTaxLine ?? `code #${currentCodeId}`} <span className="text-[10px]">(not valid for this entity type)</span></span>
            : <span>— unassigned —</span>}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b dark:border-gray-700">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search code or description…"
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div ref={listRef} className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => selectCode(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 italic hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b dark:border-gray-700"
            >
              — unassigned —
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No matching codes</p>
            ) : (
              filtered.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCode(c)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                    idx === highlightIndex ? 'bg-blue-100 dark:bg-blue-900/40 font-medium' : currentCodeId === c.id ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''
                  }`}
                >
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{c.sort_order}: {c.tax_code}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-1">— {c.description}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Account row ----

interface MappingRowViewProps {
  row: MappingRow;
  balance: number;
  selected: boolean;
  flashing: boolean;
  taxCodes: TaxCode[];
  onSelectCode: (account: Account, codeId: number | null, taxLine: string | null) => void;
  onToggle: (id: number, shift: boolean) => void;
}

/**
 * One account row, memoised on exactly what it draws. The page re-renders on
 * every checkbox click and every optimistic save; without this every row's
 * TaxCodeDropdown re-rendered too, which on a 200-account COA was the lag.
 * `row` is stable between clicks because `mappingRows` is memoised upstream,
 * and the two callbacks are `useCallback`'d for the same reason.
 */
const MappingRowView = memo(function MappingRowView({ row, balance, selected, flashing, taxCodes, onSelectCode, onToggle }: MappingRowViewProps) {
  const isUnmapped = row.taxCodeId === null && row.taxLine === null;
  const source = row.taxLineSource;
  return (
    <tr
      className={
        flashing
          ? 'bg-green-50 dark:bg-green-900/20'
          : selected
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : isUnmapped
              ? 'border-l-2 border-l-amber-400 bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/60 dark:hover:bg-amber-900/20'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }
    >
      <td className="px-3 py-2 w-8">
        <input
          type="checkbox"
          aria-label={`Select ${row.account.account_number}`}
          checked={selected}
          onChange={() => { /* handled in onClick so the shift key is visible */ }}
          onClick={(e) => onToggle(row.account.id, e.shiftKey)}
          className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
        />
      </td>
      <td className="px-3 py-2 font-mono text-sm text-gray-600 dark:text-gray-400">{row.account.account_number}</td>
      <td className="px-3 py-2 text-gray-800 dark:text-gray-200 font-medium">{row.account.account_name}</td>
      <td className={`px-3 py-2 text-right text-sm font-mono tabular-nums ${balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
        {fmtCents(balance)}
      </td>
      <td className="px-3 py-2">
        <TaxCodeDropdown
          accountId={row.account.id}
          currentCodeId={row.taxCodeId}
          currentTaxLine={row.taxLine}
          taxCodes={taxCodes}
          onSelect={(codeId, taxLine) => onSelectCode(row.account, codeId, taxLine)}
        />
      </td>
      <td className="px-3 py-2">
        {source ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SOURCE_CLASSES[source] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            {SOURCE_LABELS[source] ?? source}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {row.taxLineConfidence != null ? (
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            row.taxLineConfidence >= 0.9 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
              : row.taxLineConfidence >= 0.7 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
          }`}>
            {Math.round(row.taxLineConfidence * 100)}%
          </span>
        ) : source ? (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        ) : null}
      </td>
    </tr>
  );
});

/** Stable empty list so a not-yet-loaded query does not bust every memo below. */
const NO_TAX_CODES: TaxCode[] = [];

// ---- Main Page ----

export function TaxMappingPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const qc = useQueryClient();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [showAutoAssignConsent, setShowAutoAssignConsent] = useState(false);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoAssignSuggestions, setAutoAssignSuggestions] = useState<AssignmentSuggestion[]>([]);
  const [autoAssignError, setAutoAssignError] = useState<string | null>(null);
  const [autoAssignProgress, setAutoAssignProgress] = useState<{ done: number; total: number } | null>(null);
  // Bulk mapping: tick rows (shift-click for a range over the rows on
  // screen), pick a code in the toolbar, apply. The selection survives the
  // Show All / Unmapped / Mapped filter on purpose, so the toolbar says how
  // many selected rows are hidden — an apply hits all of them.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkCode, setBulkCode] = useState<{ id: number | null; taxLine: string | null }>({ id: null, taxLine: null });
  const [bulkApplying, setBulkApplying] = useState(false);
  const selectAnchorRef = useRef<number | null>(null);
  const visibleIdsRef = useRef<number[]>([]);
  useEffect(() => { setSelectedIds(new Set()); selectAnchorRef.current = null; }, [selectedClientId]);

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
    // Snapshot the previous cache BEFORE the optimistic write so we can
    // restore it verbatim if the server rejects the mutation. Previously the
    // row flashed green on success but on failure the fake value stuck
    // around — silently corrupting exports via the dual-write tax_line.
    onMutate: async (_variables) => {
      await qc.cancelQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
      const previous = qc.getQueryData<Account[]>(['chart-of-accounts', selectedClientId]);
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(['chart-of-accounts', selectedClientId], context.previous);
      }
      // Reason prefix for the global error toast (rejection path).
      pushToast('Tax code save failed. Your change has been reverted — please retry.', 'error');
    },
    onSuccess: (_res, variables) => {
      // Flash the row to confirm save visually.
      setFlashIds((prev) => new Set(prev).add(variables.id));
      setTimeout(() => {
        setFlashIds((prev) => {
          const next = new Set(prev);
          next.delete(variables.id);
          return next;
        });
      }, 1200);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
    },
  });

  // Build lookup maps
  const selectedClient = (clientsData ?? []).find((c: Client) => c.id === selectedClientId);
  const selectedPeriod = (periodsData ?? []).find((p: Period) => p.id === selectedPeriodId);

  // Everything derived from the queries is memoised so a selection click
  // (which re-renders the page) hands each MappingRowView the same `row`
  // object it had before, and React.memo can skip it.
  const tbMap = useMemo(() => new Map<number, TBRow>((tbData ?? []).map((r) => [r.account_id, r])), [tbData]);
  const accounts = useMemo(() => (accountsData ?? []).filter((a: Account) => a.is_active), [accountsData]);
  const taxCodes = taxCodesData ?? NO_TAX_CODES;

  // Build mapping rows
  const mappingRows: MappingRow[] = useMemo(() => accounts.map((account: Account) => ({
    account,
    tb: tbMap.get(account.id),
    taxCodeId: account.tax_code_id ?? null,
    taxLine: account.tax_line,
    taxLineSource: account.tax_line_source ?? null,
    taxLineConfidence: account.tax_line_confidence ?? null,
  })), [accounts, tbMap]);
  const balanceById = useMemo(
    () => new Map(mappingRows.map((r) => [r.account.id, accountNetBalance(r.account, tbMap)])),
    [mappingRows, tbMap],
  );

  // Progress
  const totalAccounts = mappingRows.length;
  const mappedAccounts = mappingRows.filter((r) => r.taxCodeId !== null || r.taxLine !== null).length;
  const mappedPct = totalAccounts > 0 ? Math.round((mappedAccounts / totalAccounts) * 100) : 0;

  const progressColor = mappedPct >= 80 ? 'bg-green-500' : mappedPct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const progressTextColor = mappedPct >= 80 ? 'text-green-700' : mappedPct >= 40 ? 'text-amber-700' : 'text-red-600';

  // Filtered rows
  const visibleRows = useMemo(() => mappingRows.filter((r) => {
    if (filterMode === 'unmapped') return r.taxCodeId === null && r.taxLine === null;
    if (filterMode === 'mapped') return r.taxCodeId !== null || r.taxLine !== null;
    return true;
  }), [mappingRows, filterMode]);

  // Group by category (visible rows), in the order they are drawn — which is
  // the order a shift-click range runs over.
  const rowsByCategory = useMemo(() => {
    const m = new Map<AccountCategory, MappingRow[]>();
    CATEGORY_ORDER.forEach((cat) => m.set(cat, []));
    visibleRows.forEach((r) => {
      const cat = r.account.category as AccountCategory;
      m.get(cat)?.push(r);
    });
    return m;
  }, [visibleRows]);
  const visibleIds = useMemo(
    () => CATEGORY_ORDER.flatMap((cat) => (rowsByCategory.get(cat) ?? []).map((r) => r.account.id)),
    [rowsByCategory],
  );
  visibleIdsRef.current = visibleIds;
  const countByCategory = useMemo(() => {
    const m = new Map<AccountCategory, number>();
    mappingRows.forEach((r) => {
      const cat = r.account.category as AccountCategory;
      m.set(cat, (m.get(cat) ?? 0) + 1);
    });
    return m;
  }, [mappingRows]);

  // Compute category totals (from all accounts, not filtered)
  const totalsByCategory = useMemo(() => {
    const m = new Map<AccountCategory, number>();
    CATEGORY_ORDER.forEach((cat) => m.set(cat, 0));
    mappingRows.forEach((r) => {
      const cat = r.account.category as AccountCategory;
      m.set(cat, (m.get(cat) ?? 0) + (balanceById.get(r.account.id) ?? 0));
    });
    return m;
  }, [mappingRows, balanceById]);

  // Selection
  const selectedAccounts = useMemo(() => accounts.filter((a) => selectedIds.has(a.id)), [accounts, selectedIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const hiddenSelectedCount = useMemo(() => {
    const visible = new Set(visibleIds);
    return selectedAccounts.filter((a) => !visible.has(a.id)).length;
  }, [visibleIds, selectedAccounts]);

  const clearSelection = () => { setSelectedIds(new Set()); selectAnchorRef.current = null; };
  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
    selectAnchorRef.current = null;
  };
  /** Stable (reads the on-screen order through a ref) so memoised rows never re-render for it. */
  const toggleRow = useCallback((id: number, shift: boolean) => {
    const orderedIds = visibleIdsRef.current;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const anchor = selectAnchorRef.current;
      const from = anchor === null ? -1 : orderedIds.indexOf(anchor);
      const to = orderedIds.indexOf(id);
      if (shift && from >= 0 && to >= 0 && from !== to) {
        const turnOn = !prev.has(id);
        const [lo, hi] = from < to ? [from, to] : [to, from];
        for (let i = lo; i <= hi; i++) {
          if (turnOn) next.add(orderedIds[i]); else next.delete(orderedIds[i]);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    selectAnchorRef.current = id;
  }, []);

  const revenueTotal = totalsByCategory.get('revenue') ?? 0;
  const expensesTotal = totalsByCategory.get('expenses') ?? 0;
  const netIncome = revenueTotal - expensesTotal;

  const assetsTotal = totalsByCategory.get('assets') ?? 0;
  const liabTotal = totalsByCategory.get('liabilities') ?? 0;
  const equityTotal = totalsByCategory.get('equity') ?? 0;
  // Pre-closing trial balance: current-year earnings still live in the income
  // statement accounts, so the accounting equation is
  //   Assets = Liabilities + Equity + Net Income.
  const bsBalance = assetsTotal - (liabTotal + equityTotal + netIncome);
  const bsBalanced = bsBalance === 0; // integer cents — must tie exactly

  const isLoading = accountsLoading || tbLoading;

  const { mutate: updateTaxCode } = updateMutation;
  const handleCodeSelect = useCallback((account: Account, codeId: number | null, taxLine: string | null) => {
    // Optimistic update: update query cache directly
    qc.setQueryData<Account[]>(['chart-of-accounts', selectedClientId], (prev) =>
      prev?.map((a) =>
        a.id === account.id
          ? { ...a, tax_code_id: codeId, tax_line: taxLine, tax_line_source: 'manual' as const }
          : a
      )
    );
    updateTaxCode({ id: account.id, taxCodeId: codeId });
  }, [qc, selectedClientId, updateTaxCode]);

  const flashRows = (ids: Iterable<number>) => {
    const set = new Set(ids);
    setFlashIds((prev) => new Set([...prev, ...set]));
    setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        set.forEach((id) => next.delete(id));
        return next;
      });
    }, 1200);
  };

  /** One PUT for the whole selection — the same endpoint the auto-assign confirm uses. */
  const handleBulkApply = async () => {
    if (!selectedClientId || selectedAccounts.length === 0 || bulkApplying) return;
    const ids = selectedAccounts.map((a) => a.id);
    const { id: taxCodeId, taxLine } = bulkCode;
    // Unassigning is a real action too, but with no code picked it is the
    // default state of the toolbar — so it asks before clearing a mapping.
    if (taxCodeId === null && !(await confirmAction({
      message: `Clear the tax code on ${ids.length} account${ids.length !== 1 ? 's' : ''}?`,
      tone: 'danger',
    }))) return;
    setBulkApplying(true);
    try {
      const res = await bulkConfirmTaxLines(
        selectedClientId,
        ids.map((accountId) => ({ accountId, taxCodeId, source: 'manual', confidence: null })),
      );
      if (res.error) {
        pushToast(`Bulk mapping failed: ${res.error.message}`, 'error');
        return;
      }
      const okIds = new Set((res.data?.results ?? []).filter((r) => r.success).map((r) => r.accountId));
      qc.setQueryData<Account[]>(['chart-of-accounts', selectedClientId], (prev) =>
        prev?.map((a) =>
          okIds.has(a.id)
            ? { ...a, tax_code_id: taxCodeId, tax_line: taxLine, tax_line_source: 'manual' as const, tax_line_confidence: null }
            : a
        )
      );
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
      flashRows(okIds);
      const failed = res.data?.failed ?? 0;
      pushToast(
        `${okIds.size} account${okIds.size !== 1 ? 's' : ''} ${taxCodeId !== null ? `mapped to ${taxLine}` : 'set to unassigned'}.`
          + (failed > 0 ? ` ${failed} could not be updated.` : ''),
        failed > 0 ? 'error' : 'success',
      );
      clearSelection();
    } catch (err: unknown) {
      pushToast(`Bulk mapping failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setBulkApplying(false);
    }
  };

  // Auto-assign handlers

  // Page the accounts rather than asking the server to do a whole COA in one
  // request. Each account costs the server two lookups in the waterfall, and
  // whatever falls through to the AI is a tb_tax_code_assign call — on a large
  // unmapped COA that adds up past the ~100s proxy timeout in front of the AI
  // router, which surfaces as a bare 524 with no error of our own.
  const AUTO_ASSIGN_CHUNK_SIZE = 25;

  const handleAutoAssignOpen = async () => {
    if (!selectedClientId) return;
    setAutoAssignLoading(true);
    setAutoAssignError(null);
    setAutoAssignSuggestions([]);
    try {
      // The same population the server picks for includeAll:false — active and
      // unmapped — chosen here so it can be handed over a chunk at a time.
      const targets = accounts.filter((a: Account) => a.tax_code_id === null).map((a: Account) => a.id);
      if (targets.length === 0) {
        setAutoAssignSuggestions([]);
        setAutoAssignOpen(true);
        return;
      }

      const collected: AssignmentSuggestion[] = [];
      let chunkError: string | null = null;
      for (let i = 0; i < targets.length; i += AUTO_ASSIGN_CHUNK_SIZE) {
        setAutoAssignProgress({ done: i, total: targets.length });
        const res = await autoAssignTaxLines(selectedClientId, {
          accountIds: targets.slice(i, i + AUTO_ASSIGN_CHUNK_SIZE),
        });
        if (res.error) { chunkError = res.error.message; break; }
        collected.push(...(res.data?.suggestions ?? []));
      }
      setAutoAssignProgress(null);

      // Show what was analyzed before the failure — confirming those is still
      // useful, and a re-run only has to cover what is still unmapped.
      if (chunkError && collected.length === 0) {
        setAutoAssignError(chunkError);
        return;
      }
      if (chunkError) {
        setAutoAssignError(`${chunkError} — ${collected.length} of ${targets.length} accounts were analyzed before this failed. Confirm these, then run it again for the rest.`);
      }
      // Set suggestions first, then open modal so useState initializer sees real data
      setAutoAssignSuggestions(collected);
      setAutoAssignOpen(true);
    } catch (err: unknown) {
      setAutoAssignError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAutoAssignProgress(null);
      setAutoAssignLoading(false);
    }
  };

  const handleAutoAssignConfirm = async (confirmed: AssignmentSuggestion[]) => {
    if (!selectedClientId) return;
    const assignments = confirmed
      .filter((s) => s.source !== 'existing')
      .map((s) => ({
        accountId: s.accountId,
        taxCodeId: s.overrideTaxCodeId !== undefined ? s.overrideTaxCodeId : s.suggestedTaxCodeId,
        source: s.source === 'ai' ? 'ai' : s.source === 'prior_period' ? 'prior_period' : s.source === 'cross_client' ? 'cross_client' : 'manual',
        confidence: s.confidence,
      }));

    if (assignments.length === 0) {
      setAutoAssignOpen(false);
      return;
    }

    try {
      const res = await bulkConfirmTaxLines(selectedClientId, assignments);
      if (res.error) {
        setAutoAssignError(res.error.message);
        return;
      }
      setAutoAssignOpen(false);
      // Refresh accounts
      qc.invalidateQueries({ queryKey: ['chart-of-accounts', selectedClientId] });
      // Flash all updated rows
      flashRows(assignments.map((a) => a.accountId));
    } catch (err: unknown) {
      setAutoAssignError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Guards
  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No client selected</p>
          <p className="text-sm mt-1">Choose a client from the sidebar to use Tax Mapping.</p>
        </div>
      </div>
    );
  }

  if (!selectedPeriodId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No period selected</p>
          <p className="text-sm mt-1">Choose a period from the sidebar to use Tax Mapping.</p>
        </div>
      </div>
    );
  }

  const COLS = 7;

  return (
    <div className="p-6">
      {/* Auto-assign modal */}
      {autoAssignOpen && (
        <AssignmentPreviewModal
          suggestions={autoAssignSuggestions}
          taxCodes={taxCodes}
          isLoading={autoAssignLoading}
          onConfirm={handleAutoAssignConfirm}
          onCancel={() => setAutoAssignOpen(false)}
        />
      )}
      {autoAssignError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-400">
          Auto-assign error: {autoAssignError}
          <button
            type="button"
            onClick={() => setAutoAssignError(null)}
            className="ml-3 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tax Mapping</h2>
          {selectedClient && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{selectedClient.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ENTITY_BADGE[selectedClient.entity_type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {selectedClient.entity_type}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                {(selectedClient.activity_type ?? 'business').replace('_', ' ')}
              </span>
              {selectedPeriod && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{selectedPeriod.period_name}</span>
              )}
            </div>
          )}
        </div>
        <div>
          <button
            onClick={() => setShowAutoAssignConsent(true)}
            disabled={isLoading || autoAssignLoading || !selectedClientId}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {autoAssignLoading
              ? (autoAssignProgress ? `Analyzing… ${autoAssignProgress.done} of ${autoAssignProgress.total}` : 'Analyzing…')
              : 'Auto-assign Tax Codes'}
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
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            {mode === 'all' ? 'Show All' : mode === 'unmapped' ? 'Unmapped Only' : 'Mapped Only'}
          </button>
        ))}
      </div>

      {selectedAccounts.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm flex-wrap">
          <span className="font-medium text-blue-800 dark:text-blue-300">
            {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''} selected
          </span>
          {hiddenSelectedCount > 0 && (
            <span className="text-xs text-blue-700/80 dark:text-blue-300/80">
              ({hiddenSelectedCount} hidden by the current filter — still included)
            </span>
          )}
          <div className="w-72">
            <TaxCodeDropdown
              accountId={0}
              currentCodeId={bulkCode.id}
              currentTaxLine={bulkCode.taxLine}
              taxCodes={taxCodes}
              onSelect={(id, taxLine) => setBulkCode({ id, taxLine })}
              disabled={bulkApplying}
            />
          </div>
          <button
            onClick={handleBulkApply}
            disabled={bulkApplying}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bulkApplying
              ? 'Applying…'
              : bulkCode.id !== null
                ? `Apply ${bulkCode.taxLine} to ${selectedAccounts.length}`
                : `Unassign ${selectedAccounts.length}`}
          </button>
          <button
            onClick={clearSelection}
            disabled={bulkApplying}
            className="text-xs text-blue-700 dark:text-blue-300 hover:underline"
          >
            Clear selection
          </button>
          <span className="ml-auto text-xs text-blue-700/70 dark:text-blue-300/70">Shift-click to select a range</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      aria-label={allVisibleSelected ? 'Deselect all shown accounts' : 'Select all shown accounts'}
                      checked={allVisibleSelected}
                      ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                      onChange={toggleAllVisible}
                      disabled={visibleIds.length === 0}
                      className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">Acct #</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Account Name</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-32">Balance</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-72">Tax Code</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">Source</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {CATEGORY_ORDER.map((cat) => {
                  const catRows = rowsByCategory.get(cat) ?? [];
                  const catTotal = totalsByCategory.get(cat) ?? 0;

                  if ((countByCategory.get(cat) ?? 0) === 0) return null;

                  return [
                    // Category header
                    <tr key={`header-${cat}`} className="bg-gray-100 dark:bg-gray-700">
                      <td colSpan={COLS} className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        {CATEGORY_LABELS[cat]}
                      </td>
                    </tr>,

                    // Account rows
                    ...catRows.map((row) => (
                      <MappingRowView
                        key={row.account.id}
                        row={row}
                        balance={balanceById.get(row.account.id) ?? 0}
                        selected={selectedIds.has(row.account.id)}
                        flashing={flashIds.has(row.account.id)}
                        taxCodes={taxCodes}
                        onSelectCode={handleCodeSelect}
                        onToggle={toggleRow}
                      />
                    )),

                    // Category subtotal
                    <tr key={`subtotal-${cat}`} className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700">
                      <td colSpan={3} className="px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 text-right pr-6">
                        Total {CATEGORY_LABELS[cat]}
                      </td>
                      <td className={`px-3 py-2 text-right text-sm font-mono font-bold tabular-nums ${catTotal < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {fmtCents(catTotal)}
                      </td>
                      <td colSpan={3} />
                    </tr>,
                  ];
                })}

                {/* Net Income */}
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                  <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white text-right pr-6">
                    Net Income (Loss)
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-sm font-bold ${netIncome < 0 ? 'text-red-600 dark:text-red-400' : netIncome > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {fmtCents(netIncome)}
                  </td>
                  <td colSpan={3} />
                </tr>

                {/* Balance Sheet Check */}
                <tr className={`border-t border-gray-200 dark:border-gray-700 ${bsBalanced ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <td colSpan={3} className="px-3 py-2 text-sm font-bold text-right pr-6">
                    <span className={bsBalanced ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      Assets = Liabilities + Equity + Net Income
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right text-sm font-mono font-bold tabular-nums ${bsBalanced ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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

      {showAutoAssignConsent && (
        <AiConsentDialog
          feature="AI Tax Code Auto-Assignment"
          piiItems={AI_PII.taxAutoAssign}
          onCancel={() => setShowAutoAssignConsent(false)}
          onConfirm={() => { setShowAutoAssignConsent(false); handleAutoAssignOpen(); }}
        />
      )}
    </div>
  );
}
