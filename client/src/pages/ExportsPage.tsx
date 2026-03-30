import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useUIStore } from '../store/uiStore';
import {
  validateExport,
  downloadExport,
  taxSoftwareExportUrl,
  getConsolSettings,
  saveConsolSettings,
  type TaxSoftware,
  type TaxCodeInUse,
} from '../api/exports';

const SOFTWARE_OPTIONS: { value: TaxSoftware; label: string }[] = [
  { value: 'ultratax', label: 'UltraTax CS' },
  { value: 'cch',      label: 'CCH Axcess' },
  { value: 'lacerte',  label: 'Lacerte' },
  { value: 'gosystem', label: 'GoSystem Tax RS' },
  { value: 'generic',  label: 'Generic' },
];

const SOFTWARE_EXT: Record<TaxSoftware, string> = {
  ultratax: 'xlsx',
  cch:      'xlsx',
  lacerte:  'xlsx',
  gosystem: 'xlsx',
  generic:  'xlsx',
};

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
      Balanced
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
      Out of Balance
    </span>
  );
}

export function ExportsPage() {
  const { selectedPeriodId } = useUIStore();

  const [software, setSoftware] = useState<TaxSoftware>('ultratax');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showConsolidation, setShowConsolidation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Consolidation state: which tax codes are checked + optional overrides per code
  type ConsolEntry = { acctNum: string; acctName: string };
  const [consolidateMap, setConsolidateMap] = useState<Map<number, ConsolEntry>>(new Map());
  const [expandedTc, setExpandedTc] = useState<Set<number>>(new Set());
  const [consolDirty, setConsolDirty] = useState(false);
  const [consolSaving, setConsolSaving] = useState(false);

  // Load saved consolidation settings from server on software change
  useEffect(() => {
    if (!selectedPeriodId) return;
    let cancelled = false;
    (async () => {
      const res = await getConsolSettings(selectedPeriodId, software);
      if (cancelled || res.error || !res.data) return;
      const entries = Object.entries(res.data).map(([k, v]) => [Number(k), v] as [number, ConsolEntry]);
      setConsolidateMap(new Map(entries));
      setConsolDirty(false);
    })();
    return () => { cancelled = true; };
  }, [selectedPeriodId, software]);

  // Save to server
  const saveConsolToServer = useCallback(async () => {
    if (!selectedPeriodId || !consolDirty) return;
    setConsolSaving(true);
    const settings: Record<number, { acctNum: string; acctName: string }> = {};
    for (const [id, v] of consolidateMap) settings[id] = v;
    await saveConsolSettings(selectedPeriodId, software, settings);
    setConsolDirty(false);
    setConsolSaving(false);
  }, [selectedPeriodId, software, consolidateMap, consolDirty]);

  const consolidateIds = new Set(consolidateMap.keys());

  const toggleConsolidate = useCallback((tc: TaxCodeInUse, checked: boolean) => {
    setConsolidateMap(prev => {
      const next = new Map(prev);
      if (checked) {
        const firstAcct = tc.accounts[0];
        next.set(tc.tax_code_id, {
          acctNum: tc.export_account_number || firstAcct?.account_number || tc.tax_code,
          acctName: tc.export_description || firstAcct?.account_name || tc.description,
        });
      } else {
        next.delete(tc.tax_code_id);
      }
      return next;
    });
    setConsolDirty(true);
  }, []);

  const updateOverride = useCallback((tcId: number, field: 'acctNum' | 'acctName', value: string) => {
    setConsolidateMap(prev => {
      const next = new Map(prev);
      const entry = next.get(tcId);
      if (entry) next.set(tcId, { ...entry, [field]: value });
      return next;
    });
    setConsolDirty(true);
  }, []);

  const {
    data: validationResult,
    isLoading: validating,
    error: validationError,
  } = useQuery({
    queryKey: ['export-validation', selectedPeriodId, software],
    queryFn: async () => {
      if (!selectedPeriodId) return null;
      const res = await validateExport(selectedPeriodId, software);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!selectedPeriodId,
    staleTime: 30_000,
  });

  async function handleDownload(url: string, filename: string, label: string) {
    setError(null);
    setSuccess(null);
    setDownloading(label);
    try {
      // Auto-save consolidation settings before downloading
      if (consolDirty && selectedPeriodId) {
        const settings: Record<number, { acctNum: string; acctName: string }> = {};
        for (const [id, v] of consolidateMap) settings[id] = v;
        await saveConsolSettings(selectedPeriodId, software, settings);
        setConsolDirty(false);
      }
      await downloadExport(url, filename);
      setSuccess(`${label} downloaded successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setDownloading(null);
    }
  }

  if (!selectedPeriodId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Exports</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Select a client and period to begin.</p>
      </div>
    );
  }

  const validation = validationResult;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Tax Exports</h1>

      {/* Success / error banners */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-400 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          {success}
          <button className="ml-auto text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300" onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          {error}
          <button className="ml-auto text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Pre-export Validation ─────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pre-export Validation</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Software selector here to scope validation */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400 font-medium w-28 shrink-0">Tax Software</label>
            <select
              value={software}
              onChange={(e) => setSoftware(e.target.value as TaxSoftware)}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 dark:bg-gray-700 dark:text-white"
            >
              {SOFTWARE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {validating && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">Checking…</p>
          )}

          {validationError && (
            <p className="text-sm text-red-600 dark:text-red-400">Validation error: {(validationError as Error).message}</p>
          )}

          {validation && (
            <div className="space-y-3">
              {/* Balance status */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400 w-28 shrink-0">Balance status</span>
                <StatusBadge ok={validation.isBalanced} />
                {!validation.isBalanced && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    DR: {(validation.totalDebit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    &nbsp;/&nbsp;
                    CR: {(validation.totalCredit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              {/* Unmapped accounts */}
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-28 shrink-0">Unmapped accounts</span>
                  {validation.unmappedAccounts.length === 0 ? (
                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">None</span>
                  ) : (
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {validation.unmappedAccounts.length} account{validation.unmappedAccounts.length !== 1 ? 's' : ''} —{' '}
                      <Link to="/tax-mapping" className="underline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                        Go to Tax Mapping
                      </Link>
                    </span>
                  )}
                </div>
                {validation.unmappedAccounts.length > 0 && (
                  <ul className="ml-32 mt-1 space-y-0.5">
                    {validation.unmappedAccounts.slice(0, 10).map((a) => (
                      <li key={a.account_id} className="text-xs text-gray-500 dark:text-gray-400">
                        {a.account_number} — {a.account_name}
                      </li>
                    ))}
                    {validation.unmappedAccounts.length > 10 && (
                      <li className="text-xs text-gray-400 dark:text-gray-500 italic">
                        …and {validation.unmappedAccounts.length - 10} more
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Missing software mappings */}
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-28 shrink-0">Software codes</span>
                  {validation.missingMappings.length === 0 ? (
                    <span className="text-xs text-green-700 dark:text-green-400 font-medium">All mapped</span>
                  ) : (
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {validation.missingMappings.length} account{validation.missingMappings.length !== 1 ? 's' : ''} missing {software} code
                    </span>
                  )}
                </div>
                {validation.missingMappings.length > 0 && (
                  <ul className="ml-32 mt-1 space-y-0.5">
                    {validation.missingMappings.slice(0, 10).map((a) => (
                      <li key={a.account_id} className="text-xs text-gray-500 dark:text-gray-400">
                        {a.account_number} — {a.account_name} ({a.tax_code})
                      </li>
                    ))}
                    {validation.missingMappings.length > 10 && (
                      <li className="text-xs text-gray-400 dark:text-gray-500 italic">
                        …and {validation.missingMappings.length - 10} more
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Warning callout */}
              {validation.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded px-4 py-2.5 mt-1">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1">Warnings (export still allowed)</p>
                  <ul className="space-y-0.5">
                    {validation.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings.length === 0 && (
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">All checks passed — ready to export.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Consolidation Options ─────────────────────────────────────────── */}
      {validation && validation.taxCodesInUse.length > 0 && (
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <button
            onClick={() => setShowConsolidation(!showConsolidation)}
            className="w-full px-5 py-3 flex items-center justify-between text-left border-b border-gray-100 dark:border-gray-700"
          >
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Consolidation Options</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {consolidateIds.size === 0
                  ? 'No consolidation — every account exports as a separate line'
                  : `${consolidateIds.size} tax code${consolidateIds.size !== 1 ? 's' : ''} consolidated`}
              </p>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showConsolidation ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showConsolidation && (
            <div className="px-5 py-3">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => {
                    const next = new Map(consolidateMap);
                    for (const tc of validation.taxCodesInUse.filter(t => t.account_count > 1)) {
                      if (!next.has(tc.tax_code_id)) {
                        const firstAcct = tc.accounts[0];
                        next.set(tc.tax_code_id, {
                          acctNum: tc.export_account_number || firstAcct?.account_number || tc.tax_code,
                          acctName: tc.export_description || firstAcct?.account_name || tc.description,
                        });
                      }
                    }
                    setConsolidateMap(next);
                    setConsolDirty(true);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select all multi-account
                </button>
                <button
                  onClick={() => { setConsolidateMap(new Map()); setConsolDirty(true); }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear all
                </button>
                <span className="flex-1" />
                {consolDirty && (
                  <button
                    onClick={saveConsolToServer}
                    disabled={consolSaving}
                    className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {consolSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                )}
                {!consolDirty && consolidateMap.size > 0 && (
                  <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
                )}
              </div>
              <div className="max-h-[28rem] overflow-auto border border-gray-200 dark:border-gray-700 rounded">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60 z-10">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-2 py-1.5 w-8" />
                      <th className="px-2 py-1.5 w-6" />
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">Tax Code</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">Description</th>
                      <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-14">Accts</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-24">Book Basis</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-24">Tax Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.taxCodesInUse.map((tc) => {
                      const isChecked = consolidateIds.has(tc.tax_code_id);
                      const isExpanded = expandedTc.has(tc.tax_code_id);
                      const entry = consolidateMap.get(tc.tax_code_id);
                      const fmtAmt = (n: number) => n === 0 ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      return (
                        <ConsolidationRow
                          key={tc.tax_code_id}
                          tc={tc}
                          isChecked={isChecked}
                          isExpanded={isExpanded}
                          entry={entry}
                          fmtAmt={fmtAmt}
                          onToggleCheck={(checked) => toggleConsolidate(tc, checked)}
                          onToggleExpand={() => {
                            const next = new Set(expandedTc);
                            if (next.has(tc.tax_code_id)) next.delete(tc.tax_code_id);
                            else next.add(tc.tax_code_id);
                            setExpandedTc(next);
                          }}
                          onUpdateOverride={(field, value) => updateOverride(tc.tax_code_id, field, value)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Tax Software Export ───────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Download Export</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Exports book and tax adjusted balances with software-specific line codes.
            {consolidateIds.size > 0 && <span className="text-blue-600 dark:text-blue-400 font-medium"> {consolidateIds.size} tax code{consolidateIds.size !== 1 ? 's' : ''} will be consolidated.</span>}
          </p>
          <div className="flex items-center gap-3">
            <button
              disabled={!!downloading}
              onClick={() =>
                handleDownload(
                  taxSoftwareExportUrl(selectedPeriodId, software, consolidateIds.size > 0 ? Array.from(consolidateIds) : undefined, consolidateMap.size > 0 ? consolidateMap : undefined),
                  `${software}-export-${selectedPeriodId}.${SOFTWARE_EXT[software]}`,
                  SOFTWARE_OPTIONS.find((o) => o.value === software)?.label ?? software,
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloading === (SOFTWARE_OPTIONS.find((o) => o.value === software)?.label ?? software) ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              Download {SOFTWARE_OPTIONS.find((o) => o.value === software)?.label ?? software} Export
            </button>
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500">
            Downloads as .xlsx (Excel)
          </div>
        </div>
      </section>

    </div>
  );
}

// ─── Consolidation row with expandable accounts and editable overrides ─────

function ConsolidationRow({ tc, isChecked, isExpanded, entry, fmtAmt, onToggleCheck, onToggleExpand, onUpdateOverride }: {
  tc: TaxCodeInUse;
  isChecked: boolean;
  isExpanded: boolean;
  entry?: { acctNum: string; acctName: string };
  fmtAmt: (n: number) => string;
  onToggleCheck: (checked: boolean) => void;
  onToggleExpand: () => void;
  onUpdateOverride: (field: 'acctNum' | 'acctName', value: string) => void;
}) {
  return (
    <>
      {/* Main tax code row */}
      <tr className={`border-t border-gray-100 dark:border-gray-700 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
        <td className="px-2 py-1.5 text-center">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onToggleCheck(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 w-3.5 h-3.5"
          />
        </td>
        <td className="px-1 py-1.5 text-center">
          {tc.account_count > 1 && (
            <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title={isExpanded ? 'Collapse' : 'Expand accounts'}>
              <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </td>
        <td className="px-2 py-1.5 font-mono text-gray-800 dark:text-gray-200">{tc.tax_code}</td>
        <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 truncate max-w-[14rem]">{tc.description}</td>
        <td className="px-2 py-1.5 text-center text-gray-500 dark:text-gray-400">{tc.account_count}</td>
        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">{fmtAmt(tc.totalBookAmt)}</td>
        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">{fmtAmt(tc.totalTaxAmt)}</td>
      </tr>

      {/* Editable override row (shown when checked) */}
      {isChecked && entry && (
        <tr className="bg-blue-50/30 dark:bg-blue-900/5">
          <td />
          <td />
          <td colSpan={2} className="px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 w-16 shrink-0">Export as:</span>
              <input
                value={entry.acctNum}
                onChange={(e) => onUpdateOverride('acctNum', e.target.value)}
                placeholder="Acct #"
                className="border border-blue-200 dark:border-blue-700 rounded px-1.5 py-0.5 text-xs font-mono w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <input
                value={entry.acctName}
                onChange={(e) => onUpdateOverride('acctName', e.target.value)}
                placeholder="Description"
                className="border border-blue-200 dark:border-blue-700 rounded px-1.5 py-0.5 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </td>
          <td colSpan={3} />
        </tr>
      )}

      {/* Expanded individual accounts (shown when expand arrow clicked) */}
      {isExpanded && tc.accounts.map((a, i) => (
        <tr key={i} className="bg-gray-50/50 dark:bg-gray-700/10">
          <td />
          <td />
          <td className="px-2 py-0.5 pl-6 font-mono text-gray-500 dark:text-gray-400">{a.account_number}</td>
          <td className="px-2 py-0.5 text-gray-500 dark:text-gray-400 truncate max-w-[14rem]">{a.account_name}</td>
          <td />
          <td className="px-2 py-0.5 text-right font-mono tabular-nums text-gray-500 dark:text-gray-400">{fmtAmt(a.bookAmt)}</td>
          <td className="px-2 py-0.5 text-right font-mono tabular-nums text-gray-500 dark:text-gray-400">{fmtAmt(a.taxAmt)}</td>
        </tr>
      ))}
    </>
  );
}
