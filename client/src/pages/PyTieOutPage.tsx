// SPDX-License-Identifier: BUSL-1.1
// Copyright (C) 2024–2026 Kisaes LLC

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { getComparison, clearPyData } from '../api/pyComparison';
import { ComparisonTable } from '../components/py-tieout/ComparisonTable';
import { AjePanel } from '../components/py-tieout/AjePanel';
import { ManualEntryGrid } from '../components/py-tieout/ManualEntryGrid';
import { PyImportDialog } from '../components/py-tieout/PyImportDialog';
import { PyPdfImportDialog } from '../components/py-tieout/PyPdfImportDialog';

function fmt(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PyTieOutPage() {
  const { selectedPeriodId, selectedClientId } = useUIStore();
  const qc = useQueryClient();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPdfImportDialog, setShowPdfImportDialog] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'all' | 'variances'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [clearing, setClearing] = useState(false);

  const queryKey = ['py-comparison', selectedPeriodId];

  const { data: result, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedPeriodId) return null;
      const res = await getComparison(selectedPeriodId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!selectedPeriodId,
  });

  const handleImportSuccess = () => {
    setShowImportDialog(false);
    setShowPdfImportDialog(false);
    setShowManualEntry(false);
    setSelectedAccountIds(new Set());
    qc.invalidateQueries({ queryKey });
  };

  const handleClear = async () => {
    if (!selectedPeriodId || !confirm('Clear all PY comparison data? Previously created AJEs will not be affected.')) return;
    setClearing(true);
    try {
      await clearPyData(selectedPeriodId);
      setSelectedAccountIds(new Set());
      qc.invalidateQueries({ queryKey });
    } finally {
      setClearing(false);
    }
  };

  if (!selectedPeriodId || !selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No period selected</p>
          <p className="text-sm mt-1">Choose a client and period from the sidebar.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">Loading...</div>;
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">PY Tie-Out</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Compare rolled-forward prior year balances against the bookkeeper's final trial balance</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4 text-gray-300 dark:text-gray-600">&#x2696;</div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No prior year data imported</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Import the client's final prior year trial balance to compare against the rolled-forward balances and identify variances.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => setShowImportDialog(true)}
                className="w-56 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Import from File
              </button>
              <button
                onClick={() => setShowPdfImportDialog(true)}
                className="w-56 px-4 py-2 text-sm border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 font-medium"
              >
                Import from PDF
              </button>
              <button
                onClick={() => setShowManualEntry(true)}
                className="w-56 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium"
              >
                Manual Entry
              </button>
            </div>
          </div>
        </div>

        {showImportDialog && (
          <PyImportDialog periodId={selectedPeriodId} clientId={selectedClientId} onClose={() => setShowImportDialog(false)} onSuccess={handleImportSuccess} />
        )}
        {showPdfImportDialog && (
          <PyPdfImportDialog periodId={selectedPeriodId} clientId={selectedClientId} onClose={() => setShowPdfImportDialog(false)} onSuccess={handleImportSuccess} />
        )}
        {showManualEntry && (
          <ManualEntryGrid periodId={selectedPeriodId} clientId={selectedClientId} onClose={() => setShowManualEntry(false)} onSuccess={handleImportSuccess} />
        )}
      </div>
    );
  }

  // ── Comparison state ─────────────────────────────────────────────────────

  const { source, accounts, summary } = result;
  const selectedVariances = accounts.filter((a) => selectedAccountIds.has(a.accountId) && a.status === 'diff');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">PY Tie-Out</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Source: <span className="font-medium">{source.type.toUpperCase()}</span>
              {source.filename && <> &middot; {source.filename}</>}
              {source.uploadedAt && <> &middot; {new Date(source.uploadedAt).toLocaleDateString()}</>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportDialog(true)}
              className="px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              Replace (File)
            </button>
            <button
              onClick={() => setShowPdfImportDialog(true)}
              className="px-3 py-1.5 text-sm border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Replace (PDF)
            </button>
            <button
              onClick={() => setShowManualEntry(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              Manual Entry
            </button>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
            >
              {clearing ? 'Clearing...' : 'Clear'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="px-6 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 shrink-0">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{summary.totalAccounts}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-green-700 dark:text-green-400">{summary.matched}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Matched</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{summary.variances}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Variances</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-semibold ${summary.netVarianceCents === 0 ? 'text-gray-400 dark:text-gray-500' : summary.netVarianceCents > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              {summary.netVarianceCents === 0 ? '—' : `${summary.netVarianceCents < 0 ? '(' : ''}$${fmt(summary.netVarianceCents)}${summary.netVarianceCents < 0 ? ')' : ''}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Net Variance</p>
          </div>
          <div className="flex-1" />
          {/* View toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 text-xs rounded-l border ${viewMode === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              All ({summary.totalAccounts})
            </button>
            <button
              onClick={() => setViewMode('variances')}
              className={`px-3 py-1 text-xs rounded-r border ${viewMode === 'variances' ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              Variances ({summary.variances})
            </button>
          </div>
          {/* Search */}
          <input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search..."
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Comparison table */}
      <div className="flex-1 overflow-auto">
        <ComparisonTable
          accounts={accounts}
          selectedIds={selectedAccountIds}
          onSelectionChange={setSelectedAccountIds}
          viewMode={viewMode}
          searchFilter={searchFilter}
        />
      </div>

      {/* AJE Panel */}
      {selectedVariances.length > 0 && (
        <AjePanel
          periodId={selectedPeriodId}
          clientId={selectedClientId}
          selectedAccounts={selectedVariances}
          onAjeCreated={() => {
            setSelectedAccountIds(new Set());
            qc.invalidateQueries({ queryKey });
            qc.invalidateQueries({ queryKey: ['trial-balance'] });
            qc.invalidateQueries({ queryKey: ['journal-entries'] });
          }}
        />
      )}

      {/* Import dialogs */}
      {showImportDialog && (
        <PyImportDialog periodId={selectedPeriodId} clientId={selectedClientId} onClose={() => setShowImportDialog(false)} onSuccess={handleImportSuccess} />
      )}
      {showPdfImportDialog && (
        <PyPdfImportDialog periodId={selectedPeriodId} clientId={selectedClientId} onClose={() => setShowPdfImportDialog(false)} onSuccess={handleImportSuccess} />
      )}
      {showManualEntry && (
        <ManualEntryGrid periodId={selectedPeriodId} clientId={selectedClientId} onClose={() => setShowManualEntry(false)} onSuccess={handleImportSuccess} />
      )}
    </div>
  );
}
