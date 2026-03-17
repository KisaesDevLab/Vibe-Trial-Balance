import { useState } from 'react';
import { runDiagnostics, type DiagnosticObservation } from '../api/diagnostics';
import { useUIStore } from '../store/uiStore';

const SEVERITY_STYLES: Record<string, { badge: string; row: string; icon: string }> = {
  error:   { badge: 'bg-red-100 text-red-700 border border-red-200',    row: 'bg-red-50/60',     icon: '✕' },
  warning: { badge: 'bg-amber-100 text-amber-700 border border-amber-200', row: 'bg-amber-50/60', icon: '!' },
  info:    { badge: 'bg-blue-100 text-blue-700 border border-blue-200',  row: 'bg-blue-50/30',    icon: 'i' },
};

export function DiagnosticsPage() {
  const { selectedPeriodId } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observations, setObservations] = useState<DiagnosticObservation[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  async function handleRun() {
    if (!selectedPeriodId) return;
    setLoading(true);
    setError(null);
    setObservations(null);
    try {
      const res = await runDiagnostics(selectedPeriodId);
      if (res.error) { setError(res.error.message); return; }
      setObservations(res.data.observations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diagnostics failed');
    } finally {
      setLoading(false);
    }
  }

  if (!selectedPeriodId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No period selected</p>
          <p className="text-sm mt-1">Choose a client and period from the sidebar.</p>
        </div>
      </div>
    );
  }

  const filtered = observations
    ? (filter === 'all' ? observations : observations.filter((o) => o.severity === filter))
    : null;

  const counts = observations
    ? {
        error: observations.filter((o) => o.severity === 'error').length,
        warning: observations.filter((o) => o.severity === 'warning').length,
        info: observations.filter((o) => o.severity === 'info').length,
      }
    : null;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">AI Period Diagnostics</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Claude reviews the trial balance and flags issues, variances, and observations.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analyzing…
            </>
          ) : (
            'Run AI Review'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error}
        </div>
      )}

      {!observations && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-gray-400">
          <p className="text-base font-medium mb-1">No diagnostics run yet</p>
          <p className="text-sm">Click &ldquo;Run AI Review&rdquo; to analyze this period.</p>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-gray-400">
          <p className="text-sm">Claude is reviewing the trial balance…</p>
        </div>
      )}

      {observations && counts && (
        <>
          {/* Summary badges */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All ({observations.length})
            </button>
            {counts.error > 0 && (
              <button
                onClick={() => setFilter('error')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'error' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
              >
                Errors ({counts.error})
              </button>
            )}
            {counts.warning > 0 && (
              <button
                onClick={() => setFilter('warning')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'warning' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
              >
                Warnings ({counts.warning})
              </button>
            )}
            {counts.info > 0 && (
              <button
                onClick={() => setFilter('info')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'info' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
              >
                Info ({counts.info})
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">Powered by Claude</span>
          </div>

          {/* Observations list */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filtered!.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No {filter} observations.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filtered!.map((obs, i) => {
                  const s = SEVERITY_STYLES[obs.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <li key={i} className={`flex gap-4 px-5 py-4 ${s.row}`}>
                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${s.badge}`}>
                        {s.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${s.badge}`}>
                            {obs.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">{obs.category}</span>
                        </div>
                        <p className="text-sm text-gray-700">{obs.message}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-3 text-right">
            AI analysis is for review assistance only. Always verify findings independently.
          </p>
        </>
      )}
    </div>
  );
}
