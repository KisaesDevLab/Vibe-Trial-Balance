import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { getTrialBalance, TBRow } from '../api/trialBalance';
import { downloadPdf, pdfReports } from '../api/pdfReports';
import { getCashFlow } from '../api/cashFlow';
import { listClients } from '../api/clients';
import { listPeriods } from '../api/periods';
import { getTBTickmarks, listTickmarks } from '../api/tickmarks';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtD = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function bookNet(r: TBRow): number {
  const dr = r.book_adjusted_debit, cr = r.book_adjusted_credit;
  return r.normal_balance === 'debit' ? dr - cr : cr - dr;
}

const CATEGORIES: TBRow['category'][] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
const CAT_LABEL: Record<string, string> = {
  assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expenses: 'Expenses',
};

// ── Print sections ────────────────────────────────────────────────────────────

function CoverSection({ firmName, clientName, ein, periodName, endDate, preparedBy, reviewedBy }: {
  firmName: string; clientName: string; ein: string; periodName: string;
  endDate: string; preparedBy: string; reviewedBy: string;
}) {
  return (
    <div className="print-section flex flex-col items-center justify-center min-h-screen text-center px-16">
      {firmName && <p className="text-2xl font-bold text-gray-800 mb-8">{firmName}</p>}
      <p className="text-xl font-semibold text-gray-700 mb-2">{clientName}</p>
      {ein && <p className="text-sm text-gray-500 mb-6">EIN: {ein}</p>}
      <p className="text-lg text-gray-600 mb-1">Workpaper Package</p>
      <p className="text-base text-gray-600 mb-8">{periodName}{endDate && ` — Period Ending ${endDate}`}</p>
      <div className="mt-8 text-sm text-gray-500 space-y-1">
        {preparedBy && <p>Prepared by: <span className="font-medium">{preparedBy}</span></p>}
        {reviewedBy  && <p>Reviewed by: <span className="font-medium">{reviewedBy}</span></p>}
        <p>Date: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function TocSection({ sections }: { sections: string[] }) {
  return (
    <div className="print-section px-12 py-10">
      <h2 className="text-lg font-bold mb-6 border-b border-gray-300 pb-2">Table of Contents</h2>
      <ol className="space-y-2">
        {sections.map((s, i) => (
          <li key={i} className="flex items-baseline gap-2 text-sm">
            <span className="text-gray-500 w-6">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TBSection({ rows, tickmarkMap, library }: {
  rows: TBRow[];
  tickmarkMap: Record<number, { id: number; symbol: string; description: string; color: string }[]>;
  library: { id: number; symbol: string; description: string; color: string }[];
}) {
  const tdR = 'px-2 py-0.5 text-xs text-right tabular-nums';
  const tdL = 'px-2 py-0.5 text-xs';

  const usedIds = new Set<number>();
  rows.forEach(r => (tickmarkMap[r.account_id] ?? []).forEach(t => usedIds.add(t.id)));
  const usedMarks = library.filter(t => usedIds.has(t.id));

  return (
    <div className="print-section px-6 py-6">
      <h2 className="text-base font-bold mb-3 border-b border-gray-400 pb-1">Trial Balance</h2>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-400">
            <th className="px-2 py-1 text-left font-semibold">Acct #</th>
            <th className="px-2 py-1 text-left font-semibold">Account Name</th>
            <th className="px-2 py-1 text-right font-semibold">Book Dr</th>
            <th className="px-2 py-1 text-right font-semibold">Book Cr</th>
            <th className="px-2 py-1 text-right font-semibold">Tax Dr</th>
            <th className="px-2 py-1 text-right font-semibold">Tax Cr</th>
            <th className="px-2 py-1 text-center font-semibold">Marks</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map(cat => {
            const catRows = rows.filter(r => r.category === cat);
            if (!catRows.length) return null;
            return [
              <tr key={`${cat}-hdr`} className="bg-gray-100">
                <td colSpan={7} className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide">{CAT_LABEL[cat]}</td>
              </tr>,
              ...catRows.map(r => {
                const marks = tickmarkMap[r.account_id] ?? [];
                return (
                  <tr key={r.account_id} className="border-b border-gray-100">
                    <td className={tdL}>{r.account_number}</td>
                    <td className={tdL}>{r.account_name}</td>
                    <td className={tdR}>{r.book_adjusted_debit ? fmtD(r.book_adjusted_debit) : '—'}</td>
                    <td className={tdR}>{r.book_adjusted_credit ? fmtD(r.book_adjusted_credit) : '—'}</td>
                    <td className={tdR}>{r.tax_adjusted_debit ? fmtD(r.tax_adjusted_debit) : '—'}</td>
                    <td className={tdR}>{r.tax_adjusted_credit ? fmtD(r.tax_adjusted_credit) : '—'}</td>
                    <td className="px-2 py-0.5 text-center">
                      {marks.map(t => (
                        <span key={t.id} className="inline-block px-0.5 font-mono font-bold text-xs">{t.symbol}</span>
                      ))}
                    </td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
      {usedMarks.length > 0 && (
        <div className="mt-4 border-t border-gray-300 pt-2">
          <p className="text-xs font-semibold text-gray-600 mb-1">Tickmark Legend:</p>
          {usedMarks.map(t => (
            <p key={t.id} className="text-xs text-gray-700">
              <span className="font-mono font-bold mr-2">{t.symbol}</span>{t.description}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function BalanceSheetSection({ rows }: { rows: TBRow[] }) {
  const bsCats: TBRow['category'][] = ['assets', 'liabilities', 'equity'];
  const tdR = 'px-2 py-0.5 text-xs text-right tabular-nums';
  const tdL = 'px-2 py-0.5 text-xs';

  return (
    <div className="print-section px-6 py-6">
      <h2 className="text-base font-bold mb-3 border-b border-gray-400 pb-1">Balance Sheet</h2>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-400">
            <th className="px-2 py-1 text-left font-semibold w-16">Acct #</th>
            <th className="px-2 py-1 text-left font-semibold">Account Name</th>
            <th className="px-2 py-1 text-right font-semibold w-28">Book Balance</th>
          </tr>
        </thead>
        <tbody>
          {bsCats.map(cat => {
            const catRows = rows.filter(r => r.category === cat);
            if (!catRows.length) return null;
            const total = catRows.reduce((s, r) => s + bookNet(r), 0);
            return [
              <tr key={`${cat}-hdr`} className="bg-gray-100">
                <td colSpan={3} className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide">{CAT_LABEL[cat]}</td>
              </tr>,
              ...catRows.map(r => (
                <tr key={r.account_id} className="border-b border-gray-100">
                  <td className={tdL}>{r.account_number}</td>
                  <td className={tdL}>{r.account_name}</td>
                  <td className={tdR}>{fmtD(bookNet(r))}</td>
                </tr>
              )),
              <tr key={`${cat}-sub`} className="border-t border-gray-300 font-semibold">
                <td colSpan={2} className="px-2 py-0.5 text-xs">Total {CAT_LABEL[cat]}</td>
                <td className={`${tdR} font-semibold`}>{fmtD(total)}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function IncomeStatementSection({ rows }: { rows: TBRow[] }) {
  const isCats: TBRow['category'][] = ['revenue', 'expenses'];
  const tdR = 'px-2 py-0.5 text-xs text-right tabular-nums';
  const tdL = 'px-2 py-0.5 text-xs';

  const revenue  = rows.filter(r => r.category === 'revenue').reduce((s, r) => s + bookNet(r), 0);
  const expenses = rows.filter(r => r.category === 'expenses').reduce((s, r) => s + bookNet(r), 0);
  const netIncome = revenue - expenses;

  return (
    <div className="print-section px-6 py-6">
      <h2 className="text-base font-bold mb-3 border-b border-gray-400 pb-1">Income Statement</h2>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-400">
            <th className="px-2 py-1 text-left font-semibold w-16">Acct #</th>
            <th className="px-2 py-1 text-left font-semibold">Account Name</th>
            <th className="px-2 py-1 text-right font-semibold w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {isCats.map(cat => {
            const catRows = rows.filter(r => r.category === cat);
            if (!catRows.length) return null;
            const total = catRows.reduce((s, r) => s + bookNet(r), 0);
            return [
              <tr key={`${cat}-hdr`} className="bg-gray-100">
                <td colSpan={3} className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide">{CAT_LABEL[cat]}</td>
              </tr>,
              ...catRows.map(r => (
                <tr key={r.account_id} className="border-b border-gray-100">
                  <td className={tdL}>{r.account_number}</td>
                  <td className={tdL}>{r.account_name}</td>
                  <td className={tdR}>{fmtD(bookNet(r))}</td>
                </tr>
              )),
              <tr key={`${cat}-sub`} className="border-t border-gray-300 font-semibold">
                <td colSpan={2} className="px-2 py-0.5 text-xs">Total {CAT_LABEL[cat]}</td>
                <td className={`${tdR} font-semibold`}>{fmtD(total)}</td>
              </tr>,
            ];
          })}
          <tr className="border-t-2 border-gray-400 bg-gray-50">
            <td colSpan={2} className="px-2 py-1 text-xs font-bold">Net Income / (Loss)</td>
            <td className={`${tdR} font-bold ${netIncome < 0 ? 'text-red-700' : 'text-green-700'}`}>
              {netIncome < 0 ? `(${fmtD(-netIncome)})` : fmtD(netIncome)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CashFlowSection({ periodId }: { periodId: number }) {
  const { data } = useQuery({ queryKey: ['cash-flow', periodId], queryFn: () => getCashFlow(periodId) });
  const cf = data?.data;
  if (!cf) return (
    <div className="print-section px-6 py-6">
      <h2 className="text-base font-bold mb-3 border-b border-gray-400 pb-1">Statement of Cash Flows</h2>
      <p className="text-xs text-gray-400 italic">Cash flow accounts not mapped. Configure in the Cash Flow Statement page.</p>
    </div>
  );

  const fmtS = (c: number) => c < 0 ? `(${fmtD(-c)})` : fmtD(c);
  const tdR = 'px-2 py-0.5 text-xs text-right tabular-nums';
  const tdL = 'px-2 py-0.5 text-xs';

  return (
    <div className="print-section px-6 py-6">
      <h2 className="text-base font-bold mb-3 border-b border-gray-400 pb-1">Statement of Cash Flows (Indirect Method)</h2>
      <table className="w-full text-xs border-collapse">
        <tbody>
          <tr className="bg-gray-100"><td colSpan={2} className="px-2 py-0.5 text-xs font-bold uppercase">Operating Activities</td></tr>
          <tr><td className={`${tdL} pl-6`}>Net Income</td><td className={tdR}>{fmtS(cf.operating.netIncome)}</td></tr>
          {cf.operating.nonCashItems.map(i => <tr key={i.account_id}><td className={`${tdL} pl-8`}>{i.account_name}</td><td className={tdR}>{fmtS(i.amount)}</td></tr>)}
          {cf.operating.workingCapital.map(i => <tr key={i.account_id}><td className={`${tdL} pl-8`}>{i.account_name}</td><td className={tdR}>{fmtS(i.amount)}</td></tr>)}
          <tr className="border-t border-gray-300 font-semibold"><td className={tdL}>Net Cash from Operating</td><td className={tdR}>{fmtS(cf.operating.total)}</td></tr>

          <tr className="bg-gray-100"><td colSpan={2} className="px-2 py-0.5 text-xs font-bold uppercase">Investing Activities</td></tr>
          {cf.investing.items.map(i => <tr key={i.account_id}><td className={`${tdL} pl-8`}>{i.account_name}</td><td className={tdR}>{fmtS(i.amount)}</td></tr>)}
          <tr className="border-t border-gray-300 font-semibold"><td className={tdL}>Net Cash from Investing</td><td className={tdR}>{fmtS(cf.investing.total)}</td></tr>

          <tr className="bg-gray-100"><td colSpan={2} className="px-2 py-0.5 text-xs font-bold uppercase">Financing Activities</td></tr>
          {cf.financing.items.map(i => <tr key={i.account_id}><td className={`${tdL} pl-8`}>{i.account_name}</td><td className={tdR}>{fmtS(i.amount)}</td></tr>)}
          <tr className="border-t border-gray-300 font-semibold"><td className={tdL}>Net Cash from Financing</td><td className={tdR}>{fmtS(cf.financing.total)}</td></tr>

          <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold">
            <td className={tdL}>Net Change in Cash</td><td className={tdR}>{fmtS(cf.netChange)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Section definitions ───────────────────────────────────────────────────────

const PREVIEW_SECTIONS = [
  { id: 'tb',           label: 'Trial Balance' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'income-stmt',  label: 'Income Statement' },
  { id: 'cash-flow',    label: 'Cash Flow Statement' },
] as const;

type PreviewSectionId = typeof PREVIEW_SECTIONS[number]['id'];

interface PdfReportSection {
  id: string;
  label: string;
  url: (periodId: number) => string;
  filename: (periodId: number) => string;
}

const PDF_REPORT_SECTIONS: PdfReportSection[] = [
  { id: 'pdf-tb',           label: 'Trial Balance (PDF)',         url: (id) => pdfReports.trialBalance(id),    filename: (id) => `trial-balance-${id}.pdf` },
  { id: 'pdf-is',           label: 'Income Statement (PDF)',      url: (id) => pdfReports.incomeStatement(id), filename: (id) => `income-statement-${id}.pdf` },
  { id: 'pdf-bs',           label: 'Balance Sheet (PDF)',         url: (id) => pdfReports.balanceSheet(id),    filename: (id) => `balance-sheet-${id}.pdf` },
  { id: 'pdf-je',           label: 'Journal Entries (PDF)',       url: (id) => pdfReports.journalEntries(id),  filename: (id) => `journal-entries-${id}.pdf` },
  { id: 'pdf-aje',          label: 'AJE Listing (PDF)',           url: (id) => pdfReports.ajeListing(id),      filename: (id) => `aje-listing-${id}.pdf` },
  { id: 'pdf-gl',           label: 'General Ledger (PDF)',        url: (id) => pdfReports.generalLedger(id),   filename: (id) => `general-ledger-${id}.pdf` },
  { id: 'pdf-tax-code',     label: 'Tax Code Report (PDF)',       url: (id) => pdfReports.taxCodeReport(id),   filename: (id) => `tax-code-report-${id}.pdf` },
  { id: 'pdf-wp-index',     label: 'Workpaper Index (PDF)',       url: (id) => pdfReports.workpaperIndex(id),  filename: (id) => `workpaper-index-${id}.pdf` },
  { id: 'pdf-tax-pl',       label: 'Tax-Basis P&L (PDF)',         url: (id) => pdfReports.taxBasisPl(id),      filename: (id) => `tax-basis-pl-${id}.pdf` },
  { id: 'pdf-tax-return',   label: 'Tax Return Order (PDF)',      url: (id) => pdfReports.taxReturnOrder(id),  filename: (id) => `tax-return-order-${id}.pdf` },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export function WorkpaperPackagePage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const token = useAuthStore((s) => s.token) ?? '';

  const [firmName,   setFirmName]   = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [reviewedBy, setReviewedBy] = useState('');
  const [selected,   setSelected]   = useState<Set<PreviewSectionId>>(new Set(['tb', 'balance-sheet', 'income-stmt']));
  const [selectedPdf, setSelectedPdf] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfErrors, setPdfErrors] = useState<string[]>([]);

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: listClients, enabled: !!selectedClientId });
  const { data: periodsData  } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn:  () => listPeriods(selectedClientId!),
    enabled:  !!selectedClientId,
  });
  const { data: tbData, isLoading: tbLoading, error: tbError } = useQuery({
    queryKey: ['tb', selectedPeriodId],
    queryFn:  () => getTrialBalance(selectedPeriodId!),
    enabled:  !!selectedPeriodId && showPreview,
  });
  const { data: tickmarkMapData, isLoading: tickmarkMapLoading, error: tickmarkMapError } = useQuery({
    queryKey: ['tb-tickmarks', selectedPeriodId],
    queryFn:  () => getTBTickmarks(selectedPeriodId!),
    enabled:  !!selectedPeriodId && showPreview,
  });
  const { data: tickmarkLibData, isLoading: tickmarkLibLoading, error: tickmarkLibError } = useQuery({
    queryKey: ['tickmarks', selectedClientId],
    queryFn:  () => listTickmarks(selectedClientId!),
    enabled:  !!selectedClientId && showPreview,
  });

  const client = clientsData?.data?.find(c => c.id === selectedClientId);
  const period = periodsData?.data?.find(p => p.id === selectedPeriodId);
  const tbRows = tbData?.data ?? [];
  const tickmarkMap  = tickmarkMapData?.data ?? {};
  const tickmarkLibrary = tickmarkLibData?.data ?? [];

  function togglePreview(id: PreviewSectionId) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePdf(id: string) {
    setSelectedPdf(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllPdf(checked: boolean) {
    setSelectedPdf(checked ? new Set(PDF_REPORT_SECTIONS.map(s => s.id)) : new Set());
  }

  const includedPreviewSections = PREVIEW_SECTIONS.filter(s => selected.has(s.id));
  const includedPdfSections = PDF_REPORT_SECTIONS.filter(s => selectedPdf.has(s.id));

  const tocItems = [
    'Cover Page',
    'Table of Contents',
    ...includedPreviewSections.map(s => s.label),
  ];

  const inputCls = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-gray-700 dark:text-white';
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

  const allPdfSelected = PDF_REPORT_SECTIONS.every(s => selectedPdf.has(s.id));
  const somePdfSelected = PDF_REPORT_SECTIONS.some(s => selectedPdf.has(s.id)) && !allPdfSelected;

  if (!selectedClientId || !selectedPeriodId) {
    return <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Select a client and period to generate a workpaper package.</div>;
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Workpaper Package</h1>

      {/* Cover page config */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cover Page</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Firm Name</label><input className={inputCls} value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Your firm name…" /></div>
          <div><label className={labelCls}>Prepared By</label><input className={inputCls} value={preparedBy} onChange={e => setPreparedBy(e.target.value)} /></div>
          <div><label className={labelCls}>Reviewed By</label><input className={inputCls} value={reviewedBy} onChange={e => setReviewedBy(e.target.value)} /></div>
        </div>
      </div>

      {/* Section selection */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Include Sections</h2>

        {/* Inline preview sections */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Preview / Print</p>
          <div className="space-y-1.5">
            {PREVIEW_SECTIONS.map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => togglePreview(s.id)}
                  className="rounded border-gray-300 dark:border-gray-600 text-teal-600" />
                <span className="text-sm dark:text-gray-300">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700" />

        {/* PDF report sections */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">PDF Reports</p>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={allPdfSelected}
                ref={el => { if (el) el.indeterminate = somePdfSelected; }}
                onChange={e => toggleAllPdf(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-teal-600"
              />
              Select all
            </label>
          </div>
          <div className="space-y-1.5">
            {PDF_REPORT_SECTIONS.map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selectedPdf.has(s.id)} onChange={() => togglePdf(s.id)}
                  className="rounded border-gray-300 dark:border-gray-600 text-teal-600" />
                <span className="text-sm dark:text-gray-300">{s.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={async () => {
            setShowPreview(true);
            if (includedPdfSections.length > 0 && selectedPeriodId) {
              setPdfDownloading(true);
              setPdfErrors([]);
              const errs: string[] = [];
              for (const section of includedPdfSections) {
                try {
                  await downloadPdf(section.url(selectedPeriodId), section.filename(selectedPeriodId), token);
                  await new Promise(r => setTimeout(r, 400));
                } catch (e) {
                  errs.push(`${section.label}: ${(e as Error).message}`);
                }
              }
              if (errs.length) setPdfErrors(errs);
              setPdfDownloading(false);
            }
          }}
          disabled={pdfDownloading}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded hover:bg-teal-700 disabled:opacity-50"
        >
          {pdfDownloading ? 'Downloading PDFs…' : 'Generate Package'}
        </button>
        {pdfErrors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-xs px-3 py-2 rounded space-y-1">
            {pdfErrors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}
      </div>

      {/* Preview overlay */}
      {showPreview && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          {/* Print toolbar */}
          <div className="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 px-6 py-2 flex items-center justify-between print:hidden">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {client?.name} — {period?.period_name} Workpaper Package
            </span>
            <div className="flex gap-2">
              <button onClick={() => window.print()}
                className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 font-medium">
                Print / Save as PDF
              </button>
              <button onClick={() => setShowPreview(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                Close
              </button>
            </div>
          </div>

          {/* Error / loading guards */}
          {(tbError || tickmarkMapError || tickmarkLibError || tbData?.error || tickmarkMapData?.error) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 mx-6 mt-4 print:hidden">
              Failed to load workpaper data. Please refresh and try again.
            </div>
          )}
          {(tbLoading || tickmarkMapLoading || tickmarkLibLoading) && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm print:hidden">
              Loading preview…
            </div>
          )}

          {/* Package content */}
          {!tbLoading && !tickmarkMapLoading && !tickmarkLibLoading && !tbError && !tickmarkMapError && !tickmarkLibError && (
          <div className="package-content">
            {/* Cover */}
            <CoverSection
              firmName={firmName}
              clientName={client?.name ?? ''}
              ein={client?.tax_id ?? ''}
              periodName={period?.period_name ?? ''}
              endDate={period?.end_date ?? ''}
              preparedBy={preparedBy}
              reviewedBy={reviewedBy}
            />

            {/* TOC */}
            <div className="page-break" />
            <TocSection sections={tocItems} />

            {/* Inline preview sections */}
            {selected.has('tb') && (
              <>
                <div className="page-break" />
                <TBSection rows={tbRows} tickmarkMap={tickmarkMap} library={tickmarkLibrary} />
              </>
            )}
            {selected.has('balance-sheet') && (
              <>
                <div className="page-break" />
                <BalanceSheetSection rows={tbRows} />
              </>
            )}
            {selected.has('income-stmt') && (
              <>
                <div className="page-break" />
                <IncomeStatementSection rows={tbRows} />
              </>
            )}
            {selected.has('cash-flow') && selectedPeriodId && (
              <>
                <div className="page-break" />
                <CashFlowSection periodId={selectedPeriodId} />
              </>
            )}

          </div>
          )}
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .page-break { page-break-before: always; }
          .print-section { page-break-inside: avoid; }
        }
        .page-break { border-top: 1px dashed #ccc; margin: 32px 0; }
        @media print { .page-break { border: none; margin: 0; } }
      `}</style>
    </div>
  );
}
