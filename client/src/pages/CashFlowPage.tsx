import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { getCashFlow, CashFlowLineItem } from '../api/cashFlow';
import { listAccounts, updateAccount, Account } from '../api/chartOfAccounts';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtSigned = (cents: number) => {
  if (cents < 0) return `(${fmt(-cents)})`;
  return fmt(cents);
};

export type CfCategory = 'operating' | 'investing' | 'financing' | 'non_cash' | 'cash' | null;

const CF_LABELS: Record<NonNullable<CfCategory>, string> = {
  operating: 'Operating (working capital)',
  investing: 'Investing',
  financing: 'Financing',
  non_cash:  'Non-cash add-back',
  cash:      'Cash & Equivalents',
};

const CF_OPTIONS: { value: CfCategory; label: string }[] = [
  { value: null,        label: '— Not mapped —' },
  { value: 'cash',      label: 'Cash & Equivalents' },
  { value: 'operating', label: 'Operating (working capital)' },
  { value: 'non_cash',  label: 'Non-cash add-back (e.g. depreciation)' },
  { value: 'investing', label: 'Investing' },
  { value: 'financing', label: 'Financing' },
];

// ── Configure Tab ─────────────────────────────────────────────────────────────

function ConfigureTab({ clientId }: { clientId: number }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');

  const { data: coaData } = useQuery({
    queryKey: ['accounts', clientId],
    queryFn:  () => listAccounts(clientId),
  });

  const accounts = coaData?.data ?? [];

  const updateMut = useMutation({
    mutationFn: ({ id, cat }: { id: number; cat: CfCategory }) =>
      updateAccount(id, { cashFlowCategory: cat }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts', clientId] }),
  });

  const filtered = accounts.filter(a => {
    const q = filter.toLowerCase();
    return !q || a.account_number.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q);
  });

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700';
  const tdCls = 'px-3 py-2 text-sm dark:text-gray-300';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter accounts…"
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} accounts</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Assign each balance-sheet account a cash flow category. Income-statement accounts tagged
        &ldquo;Non-cash add-back&rdquo; (e.g. depreciation expense) will be added back to operating income.
        Tag your cash and cash-equivalent accounts as &ldquo;Cash &amp; Equivalents&rdquo; for the reconciliation footer.
      </p>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th className={thCls}>Account</th>
              <th className={thCls}>Category</th>
              <th className={thCls}>Cash Flow Mapping</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a: Account) => (
              <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className={tdCls}>
                  <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">{a.account_number}</span>
                  {a.account_name}
                </td>
                <td className={tdCls}>
                  <span className="capitalize text-xs text-gray-500 dark:text-gray-400">{a.category}</span>
                </td>
                <td className={tdCls}>
                  <select
                    value={a.cash_flow_category ?? ''}
                    onChange={e => updateMut.mutate({ id: a.id, cat: (e.target.value || null) as CfCategory })}
                    className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  >
                    {CF_OPTIONS.map(o => (
                      <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
                    ))}
                  </select>
                  {a.cash_flow_category && (
                    <span className="ml-2 text-xs text-teal-600 font-medium">
                      {CF_LABELS[a.cash_flow_category]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Statement section helper ──────────────────────────────────────────────────

function Section({ title, items, total, sign = 1 }: {
  title: string;
  items: CashFlowLineItem[];
  total: number;
  sign?: number;
}) {
  const tdR = 'px-3 py-1.5 text-sm font-mono text-right tabular-nums';
  const tdL = 'px-3 py-1.5 text-sm';

  return (
    <tbody>
      <tr className="bg-teal-50 dark:bg-teal-900/20">
        <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wide">
          {title}
        </td>
      </tr>
      {items.map((item, i) => (
        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
          <td className={`${tdL} pl-8`}>
            <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">{item.account_number}</span>
            {item.account_name}
          </td>
          <td className={`${tdR} ${item.amount * sign < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
            {fmtSigned(item.amount * sign)}
          </td>
        </tr>
      ))}
      {items.length === 0 && (
        <tr className="border-t border-gray-100 dark:border-gray-700">
          <td colSpan={2} className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 pl-8 italic">
            No accounts mapped to this section
          </td>
        </tr>
      )}
      <tr className="border-t-2 border-gray-200 dark:border-gray-600 font-semibold bg-gray-50 dark:bg-gray-800/60">
        <td className={`${tdL} text-gray-700 dark:text-gray-300`}>Total</td>
        <td className={`${tdR} ${total < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
          {fmtSigned(total)}
        </td>
      </tr>
    </tbody>
  );
}

// ── Statement Tab ─────────────────────────────────────────────────────────────

function StatementTab({ periodId }: { periodId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cash-flow', periodId],
    queryFn:  () => getCashFlow(periodId),
  });

  if (isLoading) return <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Loading…</div>;

  const cf = data?.data;
  if (!cf) return <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">No data available.</div>;

  const tdR = 'px-3 py-1.5 text-sm font-mono text-right tabular-nums font-semibold';
  const tdL = 'px-3 py-1.5 text-sm font-semibold';

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={() => window.print()}
          className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 font-medium">
          Print / PDF
        </button>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm dark:text-gray-300">
          {/* Operating */}
          <tbody>
            <tr className="bg-teal-50 dark:bg-teal-900/20">
              <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wide">
                Operating Activities
              </td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-700">
              <td className="px-3 py-1.5 text-sm pl-8">Net Income</td>
              <td className={`px-3 py-1.5 text-sm font-mono text-right tabular-nums ${cf.operating.netIncome < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {fmtSigned(cf.operating.netIncome)}
              </td>
            </tr>
          </tbody>

          {cf.operating.nonCashItems.length > 0 && (
            <tbody>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td colSpan={2} className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 pl-8 pt-2">
                  Adjustments for non-cash items:
                </td>
              </tr>
              {cf.operating.nonCashItems.map((item, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-1.5 text-sm pl-12">
                    <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">{item.account_number}</span>
                    {item.account_name}
                  </td>
                  <td className="px-3 py-1.5 text-sm font-mono text-right tabular-nums">
                    {fmtSigned(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          )}

          {cf.operating.workingCapital.length > 0 && (
            <tbody>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td colSpan={2} className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 pl-8 pt-2">
                  Changes in working capital:
                </td>
              </tr>
              {cf.operating.workingCapital.map((item, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-1.5 text-sm pl-12">
                    <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">{item.account_number}</span>
                    {item.account_name}
                  </td>
                  <td className={`px-3 py-1.5 text-sm font-mono text-right tabular-nums ${item.amount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {fmtSigned(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          )}

          <tbody>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60">
              <td className={`${tdL} dark:text-gray-200`}>Net Cash from Operating Activities</td>
              <td className={`${tdR} ${cf.operating.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                {fmtSigned(cf.operating.total)}
              </td>
            </tr>
          </tbody>

          <Section title="Investing Activities" items={cf.investing.items} total={cf.investing.total} />
          <Section title="Financing Activities" items={cf.financing.items} total={cf.financing.total} />

          {/* Net change */}
          <tbody>
            <tr className="border-t-2 border-gray-400 dark:border-gray-500 bg-teal-50 dark:bg-teal-900/20">
              <td className={`${tdL} text-teal-800 dark:text-teal-400`}>Net Change in Cash</td>
              <td className={`${tdR} text-teal-800 dark:text-teal-400 ${cf.netChange < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
                {fmtSigned(cf.netChange)}
              </td>
            </tr>
            <tr className="border-t border-gray-200 dark:border-gray-700">
              <td className="px-3 py-1.5 text-sm pl-8 text-gray-600 dark:text-gray-400">Beginning Cash (prior year)</td>
              <td className="px-3 py-1.5 text-sm font-mono text-right tabular-nums">{fmtSigned(cf.beginningCash)}</td>
            </tr>
            <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 font-bold">
              <td className="px-3 py-1.5 text-sm pl-8 dark:text-white">Ending Cash</td>
              <td className="px-3 py-1.5 text-sm font-mono text-right tabular-nums dark:text-white">{fmtSigned(cf.endingCash)}</td>
            </tr>
            {Math.abs(cf.beginningCash + cf.netChange - cf.endingCash) > 1 && (
              <tr>
                <td colSpan={2} className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                  Note: Beginning cash + net change ({fmtSigned(cf.beginningCash + cf.netChange)}) differs
                  from ending cash ({fmtSigned(cf.endingCash)}). Verify all cash accounts are mapped.
                </td>
              </tr>
            )}
            {cf.beginningCash === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                  Note: Beginning cash is $0.00 — confirm prior year balances have been imported for all Cash & Equivalents accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'statement' | 'configure';

export function CashFlowPage() {
  const [tab, setTab] = useState<Tab>('statement');
  const { selectedClientId, selectedPeriodId } = useUIStore();

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: listClients, enabled: !!selectedClientId });
  const { data: periodsData } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn:  () => listPeriods(selectedClientId!),
    enabled:  !!selectedClientId,
  });

  const client = clientsData?.data?.find(c => c.id === selectedClientId);
  const period = periodsData?.data?.find(p => p.id === selectedPeriodId);

  const tabBtn = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-teal-600 text-teal-700'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
    }`;

  if (!selectedClientId || !selectedPeriodId) {
    return <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Select a client and period to view the cash flow statement.</div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Statement of Cash Flows</h1>
        {client && period && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {client.name}
            {client.tax_id && <span className="ml-2 text-gray-400 dark:text-gray-500">EIN {client.tax_id}</span>}
            <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
            {period.period_name}
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(Indirect Method)</span>
          </p>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1">
        <button className={tabBtn('statement')} onClick={() => setTab('statement')}>Statement</button>
        <button className={tabBtn('configure')} onClick={() => setTab('configure')}>Configure Mapping</button>
      </div>

      {tab === 'statement' && <StatementTab periodId={selectedPeriodId} />}
      {tab === 'configure' && <ConfigureTab clientId={selectedClientId} />}
    </div>
  );
}
