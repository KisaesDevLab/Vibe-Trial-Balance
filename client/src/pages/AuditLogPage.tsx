import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/uiStore';
import { getAuditLogAdmin, type AuditLogEntry } from '../api/auditLog';
import { DateInput } from '../components/DateInput';

const LIMIT = 50;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function actionBadgeClass(action: string): string {
  if (action === 'create') return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
  if (action === 'delete') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
  if (action === 'update') return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400';
  if (action === 'lock')   return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400';
  if (action === 'unlock') return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
  if (action === 'import') return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

// Expandable row for description
function DescriptionCell({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const text = entry.description ?? '—';
  const isLong = text.length > 80;

  if (!isLong) {
    return <span className="text-gray-600 dark:text-gray-400 text-xs">{text}</span>;
  }

  return (
    <div>
      <span className="text-gray-600 dark:text-gray-400 text-xs">
        {expanded ? text : `${text.slice(0, 80)}…`}
      </span>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
      >
        {expanded ? 'less' : 'more'}
      </button>
    </div>
  );
}

const ENTITY_TYPE_OPTIONS = [
  '',
  'journal_entry',
  'bank_transaction',
  'period',
  'chart_of_accounts',
  'reconciliation',
  'engagement_task',
  'client',
  'user',
  'backup',
];

export function AuditLogPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Reset to page 1 when filters change
  function applyFilters() {
    setPage(1);
  }

  const queryKey = ['audit-log-admin', page, entityType, action, from, to];

  const { data: result, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      getAuditLogAdmin({
        page,
        limit: LIMIT,
        entity_type: entityType || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: isAdmin,
    placeholderData: (prev) => prev,
  });

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400 font-medium">Admin access required</p>
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">Only administrators can view the audit log.</p>
        </div>
      </div>
    );
  }

  const rows: AuditLogEntry[] = result?.data ?? [];
  const total = result?.error == null ? (result as { data: AuditLogEntry[]; error: null; meta?: { total: number; page: number; limit: number } } | undefined)?.meta?.total ?? 0 : 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          System-wide record of all create, update, delete, lock, and import actions.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); applyFilters(); }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt || '— All —'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Action</label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              onBlur={applyFilters}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
              placeholder="e.g. create, lock…"
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
            <DateInput
              value={from}
              onChange={(e) => { setFrom(e.target.value); applyFilters(); }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
            <DateInput
              value={to}
              onChange={(e) => { setTo(e.target.value); applyFilters(); }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={() => { setEntityType(''); setAction(''); setFrom(''); setTo(''); setPage(1); }}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        {isLoading && (
          <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
        )}
        {isError && (
          <div className="px-5 py-10 text-center text-sm text-red-600 dark:text-red-400">Failed to load audit log.</div>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400 italic">No audit log entries found.</div>
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <th className="text-left py-2.5 px-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Date</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 dark:text-gray-400 font-medium">User</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 dark:text-gray-400 font-medium">Action</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 dark:text-gray-400 font-medium">Entity Type</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 dark:text-gray-400 font-medium">Record ID</th>
                  <th className="text-left py-2.5 px-3 text-gray-500 dark:text-gray-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 align-top">
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(entry.created_at)}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {entry.username ?? <span className="text-gray-400 dark:text-gray-500 italic">system</span>}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${actionBadgeClass(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-mono">{entry.entity_type ?? '—'}</td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{entry.entity_id ?? '—'}</td>
                    <td className="py-2 px-3 max-w-xs">
                      <DescriptionCell entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !isError && total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-gray-500 dark:text-gray-400">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
