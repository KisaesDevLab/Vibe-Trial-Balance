import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { listAccounts, Account } from '../api/chartOfAccounts';
import { getTrialBalance, TBRow } from '../api/trialBalance';
import {
  listSavedReports,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport,
  SavedReport,
  ReportSection,
  ReportColumn,
  ReportConfig,
} from '../api/savedReports';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function uid() { return Math.random().toString(36).slice(2, 9); }

function netBalance(row: TBRow, col: ReportColumn): number {
  let dr: number, cr: number;
  if (col === 'book') {
    dr = row.book_adjusted_debit; cr = row.book_adjusted_credit;
  } else if (col === 'tax') {
    dr = row.tax_adjusted_debit; cr = row.tax_adjusted_credit;
  } else {
    dr = row.prior_year_debit; cr = row.prior_year_credit;
  }
  return row.normal_balance === 'debit' ? dr - cr : cr - dr;
}

const COL_LABELS: Record<ReportColumn, string> = {
  book:        'Book (Adjusted)',
  tax:         'Tax (Adjusted)',
  'prior-year': 'Prior Year',
};

const ALL_COLUMNS: ReportColumn[] = ['book', 'tax', 'prior-year'];

const CATEGORY_ORDER: Account['category'][] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

// ── Report Viewer ─────────────────────────────────────────────────────────────

function ReportViewer({ config, periodId }: { config: ReportConfig; periodId: number }) {
  const { data: tbData } = useQuery({
    queryKey: ['tb', periodId],
    queryFn:  () => getTrialBalance(periodId),
  });

  const tbRows = tbData?.data ?? [];
  const tbMap = new Map<number, TBRow>(tbRows.map(r => [r.account_id, r]));

  const thCls = 'num px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700';
  const tdNum = 'num px-3 py-1.5 text-sm text-right tabular-nums dark:text-gray-300';
  const numCols = config.columns.length;

  const handlePrint = () => {
    const tableEl = document.getElementById('custom-report-table');
    if (!tableEl) return;
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html><html><head><title>Custom Report</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; margin: 20px; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 10px; border-bottom: 2px solid #d1d5db; }
        td { padding: 4px 10px; border-bottom: 1px solid #e5e7eb; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .hdr { text-align: left; }
        .section { background: #f0fdfa; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #115e59; padding: 5px 10px; }
        .subtotal { background: #f9fafb; font-weight: 600; border-top: 2px solid #d1d5db; }
        @media print { body { margin: 0; } }
      </style></head><body>${tableEl.outerHTML}</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 300);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={handlePrint}
          className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 font-medium">
          Print / PDF
        </button>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table id="custom-report-table" className="w-full text-sm dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th className="hdr px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                Account
              </th>
              {config.columns.map(col => (
                <th key={col} className={thCls}>{COL_LABELS[col]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.sections.map(section => {
              const sectionRows = section.accountIds
                .map(id => tbMap.get(id))
                .filter(Boolean) as TBRow[];

              const subtotals = config.columns.map(col =>
                sectionRows.reduce((s, r) => s + netBalance(r, col), 0)
              );

              return [
                <tr key={`${section.id}-hdr`} className="bg-teal-50 dark:bg-teal-900/20">
                  <td colSpan={numCols + 1}
                    className="section px-3 py-1.5 text-xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wide">
                    {section.name}
                  </td>
                </tr>,

                ...sectionRows.map(r => (
                  <tr key={r.account_id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-1.5 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 mr-2">{r.account_number}</span>
                      {r.account_name}
                    </td>
                    {config.columns.map(col => (
                      <td key={col} className={tdNum}>{fmt(netBalance(r, col))}</td>
                    ))}
                  </tr>
                )),

                section.showSubtotal && (
                  <tr key={`${section.id}-sub`} className="subtotal border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 font-semibold">
                    <td className="px-3 py-1.5 text-sm dark:text-gray-200">Total {section.name}</td>
                    {subtotals.map((t, i) => (
                      <td key={i} className={tdNum}>{fmt(t)}</td>
                    ))}
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Builder ───────────────────────────────────────────────────────────────────

function Builder({
  clientId,
  initialConfig,
  onSave,
  isSaving,
}: {
  clientId: number;
  initialConfig: ReportConfig;
  onSave: (config: ReportConfig, name: string) => void;
  isSaving: boolean;
}) {
  const [sections, setSections]         = useState<ReportSection[]>(initialConfig.sections);
  const [columns,  setColumns]          = useState<ReportColumn[]>(initialConfig.columns);
  const [activeSection, setActiveSection] = useState<string | null>(sections[0]?.id ?? null);
  const [accountFilter, setAccountFilter] = useState('');
  const [catFilter, setCatFilter]         = useState<Account['category'] | 'all'>('all');
  const [reportName, setReportName]       = useState('');

  const { data: coaData } = useQuery({
    queryKey: ['accounts', clientId],
    queryFn:  () => listAccounts(clientId),
  });
  const accounts = coaData?.data ?? [];

  // All account IDs already in any section
  const usedIds = new Set(sections.flatMap(s => s.accountIds));

  const filtered = accounts.filter(a => {
    if (catFilter !== 'all' && a.category !== catFilter) return false;
    const q = accountFilter.toLowerCase();
    return !q || a.account_number.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q);
  });

  function addSection() {
    const s: ReportSection = { id: uid(), name: 'New Section', accountIds: [], showSubtotal: true };
    setSections(prev => [...prev, s]);
    setActiveSection(s.id);
  }

  function removeSection(id: string) {
    setSections(prev => prev.filter(s => s.id !== id));
    if (activeSection === id) setActiveSection(sections.find(s => s.id !== id)?.id ?? null);
  }

  function renameSection(id: string, name: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }

  function toggleSubtotal(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, showSubtotal: !s.showSubtotal } : s));
  }

  function addAccount(accountId: number) {
    if (!activeSection) return;
    setSections(prev => prev.map(s =>
      s.id === activeSection && !s.accountIds.includes(accountId)
        ? { ...s, accountIds: [...s.accountIds, accountId] }
        : s
    ));
  }

  function removeAccount(sectionId: string, accountId: number) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, accountIds: s.accountIds.filter(id => id !== accountId) } : s
    ));
  }

  function toggleColumn(col: ReportColumn) {
    setColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  }

  const activeSec = sections.find(s => s.id === activeSection);
  const activeAccounts = activeSec
    ? activeSec.accountIds.map(id => accounts.find(a => a.id === id)).filter(Boolean) as Account[]
    : [];

  const inputCls = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-gray-700 dark:text-white';

  return (
    <div className="space-y-4">
      {/* Report name + save */}
      <div className="flex items-center gap-3">
        <input value={reportName} onChange={e => setReportName(e.target.value)}
          placeholder="Report name…"
          className={`${inputCls} w-64`} />
        <button
          onClick={() => onSave({ sections, columns }, reportName)}
          disabled={isSaving || !reportName.trim() || sections.length === 0 || columns.length === 0}
          className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 font-medium">
          {isSaving ? 'Saving…' : 'Save Report'}
        </button>
      </div>

      {/* Column selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-600">Columns:</span>
        {ALL_COLUMNS.map(col => (
          <label key={col} className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={columns.includes(col)} onChange={() => toggleColumn(col)}
              className="rounded border-gray-300 text-teal-600" />
            <span className="text-sm">{COL_LABELS[col]}</span>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4 min-h-96">
        {/* Left: account list */}
        <div className="col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700 space-y-2 bg-gray-50 dark:bg-gray-800/60">
            <input value={accountFilter} onChange={e => setAccountFilter(e.target.value)}
              placeholder="Filter accounts…" className={`${inputCls} w-full text-xs`} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value as Account['category'] | 'all')}
              className={`${inputCls} w-full text-xs`}>
              <option value="all">All categories</option>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map(a => (
              <div key={a.id}
                onClick={() => !usedIds.has(a.id) && addAccount(a.id)}
                className={`px-3 py-2 text-xs border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 ${
                  usedIds.has(a.id)
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : 'hover:bg-teal-50 dark:hover:bg-teal-900/20 cursor-pointer text-gray-800 dark:text-gray-200'
                }`}>
                <span className="font-mono text-gray-400 dark:text-gray-500 w-16 shrink-0">{a.account_number}</span>
                <span className="truncate">{a.account_name}</span>
                {!usedIds.has(a.id) && activeSection && (
                  <span className="ml-auto text-teal-500 shrink-0">+</span>
                )}
              </div>
            ))}
          </div>
          <div className="p-2 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-700">
            Click an account to add to selected section
          </div>
        </div>

        {/* Right: sections */}
        <div className="col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Sections</span>
            <button onClick={addSection}
              className="px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700">
              + Section
            </button>
          </div>

          {sections.length === 0 && (
            <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center text-xs text-gray-400 dark:text-gray-500">
              Add a section to start building your report
            </div>
          )}

          {sections.map(sec => (
            <div key={sec.id}
              className={`border rounded-lg overflow-hidden ${activeSection === sec.id ? 'border-teal-400' : 'border-gray-200 dark:border-gray-700'}`}
              onClick={() => setActiveSection(sec.id)}>
              {/* Section header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <input
                  value={sec.name}
                  onChange={e => renameSection(sec.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 text-sm font-medium bg-transparent border-0 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border focus:border-teal-400 focus:rounded px-1 dark:text-gray-200"
                />
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={sec.showSubtotal} onChange={() => toggleSubtotal(sec.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-teal-600" />
                  Subtotal
                </label>
                <button onClick={e => { e.stopPropagation(); removeSection(sec.id); }}
                  className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
              {/* Section accounts */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {activeAccounts.length === 0 && activeSection === sec.id && (
                  <div className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500 italic">
                    Click an account on the left to add it here
                  </div>
                )}
                {sec.accountIds.map(id => {
                  const a = accounts.find(x => x.id === id);
                  if (!a) return null;
                  return (
                    <div key={id} className="flex items-center px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">
                      <span className="font-mono text-gray-400 dark:text-gray-500 mr-2 w-14 shrink-0">{a.account_number}</span>
                      <span className="flex-1 truncate">{a.account_name}</span>
                      <button onClick={e => { e.stopPropagation(); removeAccount(sec.id, id); }}
                        className="ml-2 text-gray-300 hover:text-red-400">✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'build' | 'saved';

export function CustomReportPage() {
  const [tab, setTab] = useState<Tab>('saved');
  const [previewReport, setPreviewReport] = useState<SavedReport | null>(null);
  const [editConfig, setEditConfig] = useState<ReportConfig | null>(null);

  const { selectedClientId, selectedPeriodId } = useUIStore();
  const qc = useQueryClient();

  const { data: reportsData } = useQuery({
    queryKey: ['saved-reports', selectedClientId],
    queryFn:  () => listSavedReports(selectedClientId!),
    enabled:  !!selectedClientId,
  });

  const reports = reportsData?.data ?? [];

  const createMut = useMutation({
    mutationFn: ({ name, config }: { name: string; config: ReportConfig }) =>
      createSavedReport(selectedClientId!, { name, config }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-reports', selectedClientId] }); setTab('saved'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name, config }: { id: number; name: string; config: ReportConfig }) =>
      updateSavedReport(id, { name, config }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-reports', selectedClientId] }); setEditConfig(null); setPreviewReport(null); setTab('saved'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteSavedReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports', selectedClientId] }),
  });

  const tabBtn = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-teal-600 text-teal-700'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
    }`;

  if (!selectedClientId) {
    return <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Select a client to manage custom reports.</div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Custom Reports</h1>

      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1">
        <button className={tabBtn('saved')} onClick={() => setTab('saved')}>Saved Reports</button>
        <button className={tabBtn('build')} onClick={() => { setEditConfig(null); setTab('build'); }}>
          + New Report
        </button>
      </div>

      {/* Saved reports list */}
      {tab === 'saved' && (
        <div className="space-y-3">
          {reports.length === 0 && (
            <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              No saved reports — click &ldquo;+ New Report&rdquo; to create one.
            </div>
          )}
          {reports.map(report => (
            <div key={report.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">{report.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {report.config.sections.length} section{report.config.sections.length !== 1 ? 's' : ''}
                  {' · '}
                  {report.config.columns.map(c => COL_LABELS[c]).join(', ')}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {selectedPeriodId && (
                  <button onClick={() => setPreviewReport(previewReport?.id === report.id ? null : report)}
                    className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 font-medium">
                    {previewReport?.id === report.id ? 'Hide' : 'Preview'}
                  </button>
                )}
                <button onClick={() => { setEditConfig(report.config); setTab('build'); }}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 font-medium">
                  Edit
                </button>
                <button onClick={() => { if (confirm(`Delete "${report.name}"?`)) deleteMut.mutate(report.id); }}
                  className="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50 font-medium">
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* Inline preview */}
          {previewReport && selectedPeriodId && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{previewReport.name}</h2>
              <ReportViewer config={previewReport.config} periodId={selectedPeriodId} />
            </div>
          )}
        </div>
      )}

      {/* Builder */}
      {tab === 'build' && (
        <Builder
          clientId={selectedClientId}
          initialConfig={editConfig ?? { sections: [], columns: ['book'] }}
          isSaving={createMut.isPending || updateMut.isPending}
          onSave={(config, name) => createMut.mutate({ name, config })}
        />
      )}
    </div>
  );
}
