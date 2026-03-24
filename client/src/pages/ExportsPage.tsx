import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useUIStore, useAuthStore } from '../store/uiStore';
import { openPdfPreview } from '../api/pdfReports';
import {
  validateExport,
  downloadExport,
  taxSoftwareExportUrl,
  workingTbExportUrl,
  bookkeeperLetterUrl,
  type TaxSoftware,
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
  const token = useAuthStore((s) => s.token);
  const [software, setSoftware] = useState<TaxSoftware>('ultratax');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Exports</h1>

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

      {/* ── Tax Software Export ───────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tax Software Export</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Exports tax-adjusted balances with software-specific line codes for import into your tax software.
          </p>
          <div className="flex items-center gap-3">
            <select
              value={software}
              onChange={(e) => setSoftware(e.target.value as TaxSoftware)}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 dark:bg-gray-700 dark:text-white"
            >
              {SOFTWARE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <button
              disabled={!!downloading}
              onClick={() =>
                handleDownload(
                  taxSoftwareExportUrl(selectedPeriodId, software),
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

      {/* ── Other Exports ─────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Other Exports</h2>
        </div>
        <div className="px-5 py-4 space-y-3">

          {/* Working TB Excel */}
          <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Working Trial Balance</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Full TB with unadjusted, book & tax adjustments, and adjusted balances. Excel format.
              </p>
            </div>
            <button
              disabled={!!downloading}
              onClick={() =>
                handleDownload(
                  workingTbExportUrl(selectedPeriodId),
                  `working-tb-${selectedPeriodId}.xlsx`,
                  'Working TB',
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 ml-4"
            >
              {downloading === 'Working TB' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              Download (.xlsx)
            </button>
          </div>

          {/* Bookkeeper Letter PDF */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bookkeeper Letter</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Proposed book adjusting journal entries formatted as a professional letter. PDF format.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button
                disabled={!!downloading}
                onClick={() =>
                  handleDownload(
                    bookkeeperLetterUrl(selectedPeriodId, false),
                    `bookkeeper-letter-${selectedPeriodId}.pdf`,
                    'Bookkeeper Letter',
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {downloading === 'Bookkeeper Letter' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Download (PDF)
              </button>
              <button
                disabled={!!downloading}
                onClick={async () => {
                  if (!token) return;
                  try {
                    await openPdfPreview(bookkeeperLetterUrl(selectedPeriodId, true), token);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
