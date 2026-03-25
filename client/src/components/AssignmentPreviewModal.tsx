import { useState } from 'react';
import { type AssignmentSuggestion, type AssignmentSource } from '../api/taxLineAssignment';
import { type TaxCode } from '../api/taxCodes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssignmentPreviewModalProps {
  suggestions: AssignmentSuggestion[];
  taxCodes: TaxCode[];
  isLoading: boolean;
  onConfirm: (confirmed: AssignmentSuggestion[]) => void;
  onCancel: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<AssignmentSource, string> = {
  existing: 'EXISTING',
  prior_period: 'PRIOR',
  cross_client: 'CROSS-CLIENT',
  ai: 'AI',
  unmappable: 'UNMAPPABLE',
};

const SOURCE_COLORS: Record<AssignmentSource, string> = {
  existing: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  prior_period: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  cross_client: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  ai: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  unmappable: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-700 dark:text-green-400 font-semibold';
  if (confidence >= 0.7) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-red-600 dark:text-red-400 font-semibold';
}

function confidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
  if (confidence >= 0.7) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
  return 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400';
}

// ── Override Dropdown ─────────────────────────────────────────────────────────

interface OverrideDropdownProps {
  currentCodeId: number | null;
  taxCodes: TaxCode[];
  onChange: (codeId: number | null, taxCode: string | null, description: string | null) => void;
}

function OverrideDropdown({ currentCodeId, taxCodes, onChange }: OverrideDropdownProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const current = taxCodes.find((c) => c.id === currentCodeId);
  const filtered = taxCodes.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.tax_code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  const select = (code: TaxCode | null) => {
    onChange(code?.id ?? null, code?.tax_code ?? null, code?.description ?? null);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 dark:text-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[200px]"
      >
        {current ? (
          <span>
            <span className="font-mono font-medium text-gray-900 dark:text-white">{current.tax_code}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1 truncate">— {current.description}</span>
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 italic">— unassigned —</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl">
          <div className="p-2 border-b dark:border-gray-700">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or description…"
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => select(null)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 italic hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b dark:border-gray-700"
            >
              — unassigned —
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No matching codes</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 ${currentCodeId === c.id ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}`}
                >
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{c.tax_code}</span>
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

// ── Main Modal ────────────────────────────────────────────────────────────────

export function AssignmentPreviewModal({
  suggestions,
  taxCodes,
  isLoading,
  onConfirm,
  onCancel,
}: AssignmentPreviewModalProps) {
  const [localSuggestions, setLocalSuggestions] = useState<AssignmentSuggestion[]>(() =>
    suggestions.map((s) => ({
      ...s,
      overrideTaxCodeId: undefined,
      overrideTaxCode: undefined,
      overrideDescription: undefined,
      excluded: s.source === 'existing' || s.source === 'unmappable',
    }))
  );
  const [showLowConfOnly, setShowLowConfOnly] = useState(false);
  const [excludeLowConf, setExcludeLowConf] = useState(false);

  const LOW_CONF_THRESHOLD = 0.7;

  const visibleSuggestions = localSuggestions.filter((s) => {
    if (showLowConfOnly) return s.confidence < LOW_CONF_THRESHOLD && s.source !== 'existing';
    return true;
  });

  const handleOverride = (
    accountId: number,
    codeId: number | null,
    taxCode: string | null,
    description: string | null,
  ) => {
    setLocalSuggestions((prev) =>
      prev.map((s) =>
        s.accountId === accountId
          ? {
              ...s,
              overrideTaxCodeId: codeId,
              overrideTaxCode: taxCode,
              overrideDescription: description,
            }
          : s
      )
    );
  };

  const handleExcludeToggle = (accountId: number) => {
    setLocalSuggestions((prev) =>
      prev.map((s) => (s.accountId === accountId ? { ...s, excluded: !s.excluded } : s))
    );
  };

  const handleApply = () => {
    let toApply = localSuggestions.filter((s) => !s.excluded);
    if (excludeLowConf) {
      toApply = toApply.filter((s) => s.confidence >= LOW_CONF_THRESHOLD || s.overrideTaxCodeId !== undefined);
    }
    onConfirm(toApply);
  };

  const pendingCount = localSuggestions.filter((s) => !s.excluded && s.source !== 'existing').length;
  const aiCount = localSuggestions.filter((s) => s.source === 'ai').length;
  const priorCount = localSuggestions.filter((s) => s.source === 'prior_period').length;
  const crossCount = localSuggestions.filter((s) => s.source === 'cross_client').length;
  const unmappableCount = localSuggestions.filter((s) => s.source === 'unmappable').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Auto-Assign Tax Codes — Preview</h2>
            {isLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Running AI analysis…</p>
            ) : (
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {pendingCount} accounts to update
                </span>
                {priorCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                    {priorCount} prior
                  </span>
                )}
                {crossCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                    {crossCount} cross-client
                  </span>
                )}
                {aiCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                    {aiCount} AI
                  </span>
                )}
                {unmappableCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                    {unmappableCount} unmappable
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <div className="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-gray-600 dark:text-gray-300">Analyzing accounts with AI…</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">This may take a moment</p>
            </div>
          </div>
        ) : (
          <>
            {/* Filter controls */}
            <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLowConfOnly}
                  onChange={(e) => setShowLowConfOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                Show only low confidence (&lt;70%)
              </label>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeLowConf}
                  onChange={(e) => setExcludeLowConf(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                Exclude low confidence when applying
              </label>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-8">
                      <span className="sr-only">Include</span>
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">Acct #</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Account Name</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">Source</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">Confidence</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-56">Suggested Code</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-56">Override</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {visibleSuggestions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                        No accounts match the current filter.
                      </td>
                    </tr>
                  ) : (
                    visibleSuggestions.map((s) => {
                      const isExcluded = s.excluded ?? false;
                      const effectiveCodeId =
                        s.overrideTaxCodeId !== undefined ? s.overrideTaxCodeId : s.suggestedTaxCodeId;
                      const effectiveTaxCode =
                        s.overrideTaxCodeId !== undefined ? s.overrideTaxCode : s.suggestedTaxCode;
                      const effectiveDescription =
                        s.overrideTaxCodeId !== undefined ? s.overrideDescription : s.suggestedDescription;

                      return (
                        <tr
                          key={s.accountId}
                          className={`transition-colors ${
                            isExcluded
                              ? 'opacity-40 bg-gray-50 dark:bg-gray-700/30'
                              : s.source === 'unmappable'
                              ? 'bg-red-50/40 dark:bg-red-900/10'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => handleExcludeToggle(s.accountId)}
                              disabled={s.source === 'unmappable' && s.suggestedTaxCodeId === null && s.overrideTaxCodeId === undefined}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {s.accountNumber}
                          </td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200 font-medium">
                            {s.accountName}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[s.source]}`}>
                              {SOURCE_LABELS[s.source]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {s.source !== 'unmappable' ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${confidenceBadgeColor(s.confidence)}`}>
                                <span className={confidenceColor(s.confidence)}>
                                  {Math.round(s.confidence * 100)}%
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {effectiveTaxCode ? (
                              <div>
                                <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                                  {effectiveTaxCode}
                                </span>
                                {effectiveDescription && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                    {effectiveDescription}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs italic">None</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <OverrideDropdown
                              currentCodeId={effectiveCodeId}
                              taxCodes={taxCodes}
                              onChange={(codeId, taxCode, desc) =>
                                handleOverride(s.accountId, codeId, taxCode, desc)
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                            <span className="line-clamp-2">{s.reasoning}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 rounded-b-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pendingCount} account{pendingCount !== 1 ? 's' : ''} selected for update
                {excludeLowConf && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2">
                    (low confidence will be excluded)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={pendingCount === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Apply Selected ({pendingCount})
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
