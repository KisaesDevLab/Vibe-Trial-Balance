// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/uiStore';
import { getAiUsageDetail, type AiUsageDetailRow, type AiUsageStatus } from '../api/aiUsage';
import { DateInput } from '../components/DateInput';

const LIMIT = 50;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function fmtCost(val: string | null): string {
  if (val == null) return '—';
  const n = Number(val);
  if (n === 0) return '$0.000000';
  return `$${n.toFixed(6)}`;
}

function endpointBadgeClass(endpoint: string): string {
  if (endpoint.startsWith('tax'))       return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400';
  if (endpoint.startsWith('pdf'))       return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
  if (endpoint.startsWith('csv'))       return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400';
  if (endpoint.startsWith('support'))   return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
  if (endpoint.startsWith('diagnosti')) return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400';
  if (endpoint.startsWith('bank'))      return 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

function statusBadgeClass(status: AiUsageStatus): string {
  switch (status) {
    case 'success':     return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
    case 'truncated':   return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
    case 'parse_error': return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400';
    case 'error':       return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
  }
}

function statusLabel(status: AiUsageStatus): string {
  switch (status) {
    case 'success':     return 'OK';
    case 'truncated':   return 'Truncated';
    case 'parse_error': return 'Parse error';
    case 'error':       return 'Error';
  }
}

export function AiUsageLogPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [page, setPage]         = useState(1);
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel]       = useState('');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [status, setStatus]     = useState<AiUsageStatus | ''>('');
  const [detailRow, setDetailRow] = useState<AiUsageDetailRow | null>(null);

  const params = {
    page, limit: LIMIT,
    endpoint: endpoint || undefined,
    model:    model    || undefined,
    from:     from     || undefined,
    to:       to       || undefined,
    status:   status   || undefined,
  };

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ['ai-usage-detail', params],
    queryFn: () => getAiUsageDetail(params),
    enabled: isAdmin,
  });

  const rows: AiUsageDetailRow[] = result?.data ?? [];
  const meta = result?.meta;
  const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 1;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Admin access required to view AI usage logs.
      </div>
    );
  }

  function handleFilter() {
    setPage(1);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">AI Usage Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Per-call log of all AI API requests. Click a row for details. Admin only.</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Endpoint</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="e.g. diagnostics"
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-44 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. claude-haiku"
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-44 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AiUsageStatus | '')}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-36 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All</option>
            <option value="success">OK</option>
            <option value="truncated">Truncated</option>
            <option value="parse_error">Parse error</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-36 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <DateInput value={to} onChange={(e) => setTo(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-36 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <button
          onClick={handleFilter}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
        >
          Filter
        </button>
        <button
          onClick={() => { setEndpoint(''); setModel(''); setFrom(''); setTo(''); setStatus(''); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Clear
        </button>
        {meta && (
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 self-end">
            {meta.total.toLocaleString()} total calls
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500 dark:text-red-400">Failed to load AI usage log.</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500 italic">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Timestamp</th>
                  <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Endpoint</th>
                  <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Model</th>
                  <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">In</th>
                  <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Out</th>
                  <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Duration</th>
                  <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Est. Cost</th>
                  <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">User</th>
                  <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setDetailRow(row)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                  >
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono">
                      {fmtDate(row.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${statusBadgeClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${endpointBadgeClass(row.endpoint)}`}>
                        {row.endpoint}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">
                      {row.model}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-mono">
                      {Number(row.input_tokens).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-mono">
                      {Number(row.output_tokens).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-mono">
                      {fmtDuration(row.duration_ms)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 font-mono">
                      {fmtCost(row.estimated_cost_usd)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {row.username ?? <span className="italic text-gray-400 dark:text-gray-500">system</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {row.client_name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {detailRow && (
        <AiUsageDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-gray-900 dark:text-gray-100 break-words">{children}</div>
    </div>
  );
}

function AiUsageDetailDrawer({ row, onClose }: { row: AiUsageDetailRow; onClose: () => void }) {
  const tokensLine = row.max_tokens != null
    ? `${row.output_tokens.toLocaleString()} / ${row.max_tokens.toLocaleString()}`
    : row.output_tokens.toLocaleString();
  const hitCap = row.max_tokens != null && row.output_tokens >= row.max_tokens - 10;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-800 h-full overflow-y-auto shadow-xl border-l border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Call details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-3">
          <DetailRow label="Timestamp">
            <span className="font-mono">{fmtDateTime(row.created_at)}</span>
          </DetailRow>
          <DetailRow label="Status">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${statusBadgeClass(row.status)}`}>
              {statusLabel(row.status)}
            </span>
            {hitCap && row.status === 'success' && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">(hit max_tokens cap)</span>
            )}
          </DetailRow>
          <DetailRow label="Endpoint">
            <span className="font-mono">{row.endpoint}</span>
          </DetailRow>
          <DetailRow label="Model">
            <span className="font-mono">{row.model}</span>
          </DetailRow>
          <DetailRow label="Input tokens">
            <span className="font-mono">{row.input_tokens.toLocaleString()}</span>
          </DetailRow>
          <DetailRow label="Output / max">
            <span className="font-mono">{tokensLine}</span>
          </DetailRow>
          <DetailRow label="Finish reason">
            <span className="font-mono">{row.finish_reason ?? '—'}</span>
          </DetailRow>
          <DetailRow label="Duration">
            <span className="font-mono">{fmtDuration(row.duration_ms)}</span>
          </DetailRow>
          <DetailRow label="HTTP status">
            <span className="font-mono">{row.http_status ?? '—'}</span>
          </DetailRow>
          <DetailRow label="Est. cost">
            <span className="font-mono">{fmtCost(row.estimated_cost_usd)}</span>
          </DetailRow>
          <DetailRow label="User">
            {row.username ?? <span className="italic text-gray-400">system</span>}
          </DetailRow>
          <DetailRow label="Client">
            {row.client_name ?? <span className="text-gray-400">—</span>}
          </DetailRow>
          {row.error_message && (
            <DetailRow label="Error">
              <pre className="font-mono text-xs whitespace-pre-wrap text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                {row.error_message}
              </pre>
            </DetailRow>
          )}
        </div>
      </div>
    </div>
  );
}
