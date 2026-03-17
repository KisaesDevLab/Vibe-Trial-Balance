import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useUIStore } from '../store/uiStore';
import { getTrialBalance, TBRow } from '../api/trialBalance';
import {
  listM1Adjustments,
  createM1Adjustment,
  updateM1Adjustment,
  deleteM1Adjustment,
  M1Adjustment,
  M1Input,
  M1_CATEGORIES,
} from '../api/taxWorkpapers';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtDiff = (cents: number) => {
  const s = fmt(Math.abs(cents));
  if (cents < 0) return `(${s})`;
  return s;
};

function parseCents(v: string): number {
  const n = parseFloat(v.replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function netBalance(row: TBRow, kind: 'book' | 'tax'): number {
  const dr = kind === 'book' ? row.book_adjusted_debit : row.tax_adjusted_debit;
  const cr = kind === 'book' ? row.book_adjusted_credit : row.tax_adjusted_credit;
  return row.normal_balance === 'debit' ? dr - cr : cr - dr;
}

// ── M-1 Modal ─────────────────────────────────────────────────────────────────

interface ModalProps {
  initial?: M1Adjustment;
  onClose: () => void;
  onSave: (input: M1Input) => void;
}

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/;

function isValidAmountStr(v: string): boolean {
  const cleaned = v.replace(/[$,\s]/g, '');
  return cleaned === '' || AMOUNT_RE.test(cleaned);
}

function M1Modal({ initial, onClose, onSave }: ModalProps) {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [bookStr, setBookStr] = useState(initial ? (initial.book_amount / 100).toFixed(2) : '');
  const [taxStr, setTaxStr] = useState(initial ? (initial.tax_amount / 100).toFixed(2) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [amountError, setAmountError] = useState<string | null>(null);

  function validateAmounts(): boolean {
    if (!isValidAmountStr(bookStr) || !isValidAmountStr(taxStr)) {
      setAmountError('Please enter a valid dollar amount (e.g. 1234.56)');
      return false;
    }
    setAmountError(null);
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAmounts()) return;
    onSave({
      description,
      category:  category || null,
      bookAmount: parseCents(bookStr),
      taxAmount:  parseCents(taxStr),
      notes: notes || null,
    });
  }

  const inputCls = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500';
  const inputErrCls = 'w-full border border-red-400 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold">{initial ? 'Edit Adjustment' : 'Add M-1 Adjustment'}</h2>

        <div>
          <label className={labelCls}>Description *</label>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} required />
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">— Select or leave blank —</option>
            {M1_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Book Amount ($)</label>
            <input
              className={amountError ? inputErrCls : inputCls}
              value={bookStr}
              onChange={e => { setBookStr(e.target.value); setAmountError(null); }}
              onBlur={validateAmounts}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={labelCls}>Tax Amount ($)</label>
            <input
              className={amountError ? inputErrCls : inputCls}
              value={taxStr}
              onChange={e => { setTaxStr(e.target.value); setAmountError(null); }}
              onBlur={validateAmounts}
              placeholder="0.00"
            />
          </div>
        </div>
        {amountError && (
          <p className="text-xs text-red-600 -mt-2">{amountError}</p>
        )}

        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={!!amountError}
            className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ── M-1 Worksheet Tab ─────────────────────────────────────────────────────────

function M1WorksheetTab({ periodId }: { periodId: number }) {
  const qc = useQueryClient();
  const [modalAdj, setModalAdj] = useState<M1Adjustment | null | 'new'>(null);

  const { data: adjData } = useQuery({
    queryKey: ['m1', periodId],
    queryFn:  () => listM1Adjustments(periodId),
  });

  const { data: tbData } = useQuery({
    queryKey: ['tb', periodId],
    queryFn:  () => getTrialBalance(periodId),
  });

  const adjs = adjData?.data ?? [];
  const tbRows = tbData?.data ?? [];

  // Book net income from TB
  const bookNetIncome = tbRows.reduce((sum, r) => {
    if (r.category === 'revenue')  return sum + netBalance(r, 'book');
    if (r.category === 'expenses') return sum - netBalance(r, 'book');
    return sum;
  }, 0);

  const taxNetIncome = tbRows.reduce((sum, r) => {
    if (r.category === 'revenue')  return sum + netBalance(r, 'tax');
    if (r.category === 'expenses') return sum - netBalance(r, 'tax');
    return sum;
  }, 0);

  const totalBookAdj = adjs.reduce((s, a) => s + a.book_amount, 0);
  const totalTaxAdj  = adjs.reduce((s, a) => s + a.tax_amount, 0);
  const totalDiff    = adjs.reduce((s, a) => s + (a.tax_amount - a.book_amount), 0);
  const taxableIncome = bookNetIncome + totalDiff;

  const createMut = useMutation({
    mutationFn: (input: M1Input) => createM1Adjustment(periodId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['m1', periodId] }); setModalAdj(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<M1Input> }) => updateM1Adjustment(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['m1', periodId] }); setModalAdj(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteM1Adjustment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m1', periodId] }),
  });

  function exportExcel() {
    const rows: (string | number)[][] = [
      ['M-1 Book-to-Tax Reconciliation'],
      [],
      ['Description', 'Category', 'Book Amount', 'Tax Amount', 'Difference'],
      ...adjs.map(a => [
        a.description,
        a.category ?? '',
        a.book_amount / 100,
        a.tax_amount  / 100,
        (a.tax_amount - a.book_amount) / 100,
      ]),
      [],
      ['', '', totalBookAdj / 100, totalTaxAdj / 100, totalDiff / 100],
      [],
      ['Book Net Income (from TB)', '', '', '', bookNetIncome / 100],
      ['Net M-1 Adjustments',       '', '', '', totalDiff / 100],
      ['Taxable Income',            '', '', '', taxableIncome / 100],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'M-1 Worksheet');
    XLSX.writeFile(wb, 'm1_worksheet.xlsx');
  }

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200';
  const tdCls = 'px-3 py-2 text-sm';
  const numCls = `${tdCls} text-right tabular-nums`;
  const summaryRow = 'flex justify-between items-center py-1.5 text-sm border-b border-gray-100';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">M-1 Book-to-Tax Adjustments</h2>
        <div className="flex gap-2">
          <button onClick={exportExcel}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 font-medium">
            Export Excel
          </button>
          <button onClick={() => window.print()}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 font-medium">
            Print / PDF
          </button>
          <button onClick={() => setModalAdj('new')}
            className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 font-medium">
            + Add Adjustment
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={thCls}>Description</th>
              <th className={thCls}>Category</th>
              <th className={`${thCls} text-right`}>Book Amount</th>
              <th className={`${thCls} text-right`}>Tax Amount</th>
              <th className={`${thCls} text-right`}>Difference</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {adjs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                  No M-1 adjustments — click &ldquo;Add Adjustment&rdquo; to begin
                </td>
              </tr>
            )}
            {adjs.map(a => {
              const diff = a.tax_amount - a.book_amount;
              return (
                <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className={tdCls}>
                    <div className="font-medium">{a.description}</div>
                    {a.notes && <div className="text-xs text-gray-400 mt-0.5">{a.notes}</div>}
                  </td>
                  <td className={tdCls}>
                    {a.category && (
                      <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                        {a.category}
                      </span>
                    )}
                  </td>
                  <td className={numCls}>{fmt(a.book_amount)}</td>
                  <td className={numCls}>{fmt(a.tax_amount)}</td>
                  <td className={`${numCls} ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-700' : ''}`}>
                    {fmtDiff(diff)}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <button onClick={() => setModalAdj(a)}
                      className="text-xs text-teal-600 hover:text-teal-800 mr-3">Edit</button>
                    <button onClick={() => { if (confirm('Delete this adjustment?')) deleteMut.mutate(a.id); }}
                      className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              );
            })}
            {adjs.length > 0 && (
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className={tdCls} colSpan={2}>Total Adjustments</td>
                <td className={numCls}>{fmt(totalBookAdj)}</td>
                <td className={numCls}>{fmt(totalTaxAdj)}</td>
                <td className={`${numCls} ${totalDiff > 0 ? 'text-red-600' : totalDiff < 0 ? 'text-green-700' : ''}`}>
                  {fmtDiff(totalDiff)}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-w-sm">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Reconciliation Summary
        </h3>
        <div className={summaryRow}>
          <span className="text-gray-600">Book Net Income</span>
          <span className="font-medium tabular-nums">{fmt(bookNetIncome)}</span>
        </div>
        <div className={summaryRow}>
          <span className="text-gray-600">Net M-1 Adjustments</span>
          <span className={`font-medium tabular-nums ${totalDiff > 0 ? 'text-red-600' : totalDiff < 0 ? 'text-green-700' : ''}`}>
            {totalDiff >= 0 ? '+' : ''}{fmtDiff(totalDiff)}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 text-sm font-bold border-t border-gray-300 mt-1">
          <span>Taxable Income</span>
          <span className="tabular-nums">{fmt(taxableIncome)}</span>
        </div>
        {Math.abs(taxableIncome - taxNetIncome) > 1 && (
          <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Note: Tax-adjusted TB net income is {fmt(taxNetIncome)}.
            Difference of {fmt(Math.abs(taxableIncome - taxNetIncome))} may indicate missing adjustments.
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAdj === 'new' && (
        <M1Modal
          onClose={() => setModalAdj(null)}
          onSave={input => createMut.mutate(input)}
        />
      )}
      {modalAdj && modalAdj !== 'new' && (
        <M1Modal
          initial={modalAdj}
          onClose={() => setModalAdj(null)}
          onSave={input => updateMut.mutate({ id: (modalAdj as M1Adjustment).id, input })}
        />
      )}
    </div>
  );
}

// ── Tax Basis Schedule Tab ────────────────────────────────────────────────────

const CATEGORY_ORDER: TBRow['category'][] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
const CATEGORY_LABELS: Record<TBRow['category'], string> = {
  assets:      'Assets',
  liabilities: 'Liabilities',
  equity:      'Equity',
  revenue:     'Revenue',
  expenses:    'Expenses',
};

function TaxBasisTab({ periodId }: { periodId: number }) {
  const { data: tbData } = useQuery({
    queryKey: ['tb', periodId],
    queryFn:  () => getTrialBalance(periodId),
  });

  const rows = tbData?.data ?? [];

  function exportExcel() {
    const header = ['Account #', 'Account Name', 'Category', 'Book Balance', 'Tax Balance', 'Difference'];
    const dataRows = rows.map(r => {
      const book = netBalance(r, 'book');
      const tax  = netBalance(r, 'tax');
      return [r.account_number, r.account_name, CATEGORY_LABELS[r.category], book / 100, tax / 100, (tax - book) / 100];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tax Basis Schedule');
    XLSX.writeFile(wb, 'tax_basis_schedule.xlsx');
  }

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200';
  const tdCls = 'px-3 py-2 text-sm';
  const numCls = `${tdCls} text-right tabular-nums`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Tax Basis Schedule — Book vs. Tax Balances</h2>
        <div className="flex gap-2">
          <button onClick={exportExcel}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 font-medium">
            Export Excel
          </button>
          <button onClick={() => window.print()}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 font-medium">
            Print / PDF
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={thCls}>Account</th>
              <th className={`${thCls} text-right`}>Book Balance</th>
              <th className={`${thCls} text-right`}>Tax Balance</th>
              <th className={`${thCls} text-right`}>Difference</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map(cat => {
              const catRows = rows.filter(r => r.category === cat);
              if (catRows.length === 0) return null;

              const bookTotal = catRows.reduce((s, r) => s + netBalance(r, 'book'), 0);
              const taxTotal  = catRows.reduce((s, r) => s + netBalance(r, 'tax'),  0);
              const diffTotal = taxTotal - bookTotal;

              return [
                // Category header
                <tr key={`${cat}-hdr`} className="bg-teal-50">
                  <td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-teal-800 uppercase tracking-wide">
                    {CATEGORY_LABELS[cat]}
                  </td>
                </tr>,

                // Account rows
                ...catRows.map(r => {
                  const book = netBalance(r, 'book');
                  const tax  = netBalance(r, 'tax');
                  const diff = tax - book;
                  return (
                    <tr key={r.account_id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className={tdCls}>
                        <span className="text-gray-500 mr-2">{r.account_number}</span>
                        {r.account_name}
                      </td>
                      <td className={numCls}>{fmt(book)}</td>
                      <td className={numCls}>{fmt(tax)}</td>
                      <td className={`${numCls} ${Math.abs(diff) > 0 ? 'font-medium text-amber-700' : 'text-gray-400'}`}>
                        {diff !== 0 ? fmtDiff(diff) : '—'}
                      </td>
                    </tr>
                  );
                }),

                // Subtotal
                <tr key={`${cat}-sub`} className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className={tdCls}>Total {CATEGORY_LABELS[cat]}</td>
                  <td className={numCls}>{fmt(bookTotal)}</td>
                  <td className={numCls}>{fmt(taxTotal)}</td>
                  <td className={`${numCls} ${Math.abs(diffTotal) > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                    {diffTotal !== 0 ? fmtDiff(diffTotal) : '—'}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'm1' | 'basis';

export function TaxWorksheetsPage() {
  const [tab, setTab] = useState<Tab>('m1');
  const { selectedClientId, selectedPeriodId } = useUIStore();

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn:  listClients,
    enabled:  !!selectedClientId,
  });

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
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  if (!selectedClientId || !selectedPeriodId) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Select a client and period to view tax worksheets.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="print:mb-4">
        <h1 className="text-lg font-bold text-gray-800">Tax Worksheets</h1>
        {client && period && (
          <p className="text-sm text-gray-500 mt-0.5">
            {client.name}
            {client.tax_id && <span className="ml-2 text-gray-400">EIN {client.tax_id}</span>}
            <span className="mx-2 text-gray-300">|</span>
            {period.period_name}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1">
        <button className={tabBtn('m1')}    onClick={() => setTab('m1')}>
          M-1 Worksheet
        </button>
        <button className={tabBtn('basis')} onClick={() => setTab('basis')}>
          Tax Basis Schedule
        </button>
      </div>

      {/* Content */}
      {tab === 'm1'    && <M1WorksheetTab  periodId={selectedPeriodId} />}
      {tab === 'basis' && <TaxBasisTab     periodId={selectedPeriodId} />}
    </div>
  );
}
