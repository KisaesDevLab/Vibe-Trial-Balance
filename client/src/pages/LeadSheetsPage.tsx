// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listLeadSheets,
  listUnassignedAccounts,
  seedLeadSheets,
  createLeadSheet,
  updateLeadSheet,
  deleteLeadSheet,
  reorderLeadSheets,
  assignAccounts,
  getPeriodLeadSheets,
  signLeadSheet,
  unsignLeadSheet,
  SIGNOFF_BADGE_CLASSES,
  type LeadSheet,
  type LeadSheetPeriodDetail,
  type LeadSheetMemberRow,
  type SignoffRole,
  type SignoffStatus,
} from '../api/leadSheets';
import { TICKMARK_COLOR_CLASSES, type TickmarkColor } from '../api/tickmarks';
import { useUIStore, pushToast } from '../store/uiStore';
import { confirmAction } from '../components/ConfirmDialog';
import { categoryNet } from '../lib/accounting';
import { LeadSheetAssignmentModal } from '../components/LeadSheetAssignmentModal';
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  type LeadSheetAttachment,
} from '../api/leadSheetAttachments';
import { listTickmarks } from '../api/tickmarks';

// pdfjs is ~1 MB; keep it out of the initial bundle.
const LeadSheetPdfViewer = lazy(() =>
  import('../components/LeadSheetPdfViewer').then((m) => ({ default: m.LeadSheetPdfViewer })),
);

function fmt(cents: number): string {
  if (cents === 0) return '—';
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

// Category-based signing, never normal_balance — a contra account whose flag
// disagrees with its category would otherwise export inverted.
const net = (r: LeadSheetMemberRow, dr: number, cr: number): number => categoryNet(r.category, dr, cr);

function SignBadge({ role, status }: { role: SignoffRole; status: SignoffStatus }) {
  const letter = role === 'preparer' ? 'P' : 'R';
  return (
    <span
      title={`${role === 'preparer' ? 'Preparer' : 'Reviewer'}: ${
        status === 'signed' ? 'signed' : status === 'stale' ? 'signed, then balances changed' : 'not signed'
      }`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${SIGNOFF_BADGE_CLASSES[status]}`}
    >
      {letter}
    </span>
  );
}

interface SignoffControlProps {
  role: SignoffRole;
  detail: LeadSheetPeriodDetail;
  busy: boolean;
  onSign: (role: SignoffRole) => void;
  onUnsign: (role: SignoffRole) => void;
}

function SignoffControl({ role, detail, busy, onSign, onUnsign }: SignoffControlProps) {
  const status = detail.status[role];
  const so = detail.signoffs[role];
  const label = role === 'preparer' ? 'Preparer' : 'Reviewer';

  if (status === 'unsigned') {
    return (
      <button
        onClick={() => onSign(role)}
        disabled={busy}
        className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
      >
        Sign off as {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`px-2 py-0.5 rounded font-medium ${SIGNOFF_BADGE_CLASSES[status]}`}>{label}</span>
      <span className="text-gray-600 dark:text-gray-400">
        {so?.user_name ?? 'Unknown'} · {so ? new Date(so.signed_at).toLocaleDateString() : ''}
      </span>
      {status === 'stale' && (
        <button
          onClick={() => onSign(role)}
          disabled={busy}
          className="text-amber-700 dark:text-amber-400 underline hover:no-underline disabled:opacity-50"
        >
          Re-sign
        </button>
      )}
      <button
        onClick={() => onUnsign(role)}
        disabled={busy}
        aria-label={`Remove ${label} sign-off`}
        className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 disabled:opacity-50"
      >
        &times;
      </button>
    </div>
  );
}

export function LeadSheetsPage() {
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameCode, setRenameCode] = useState('');
  const [renameName, setRenameName] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [busyRole, setBusyRole] = useState<SignoffRole | null>(null);
  const [viewing, setViewing] = useState<LeadSheetAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sheetsQuery = useQuery({
    queryKey: ['lead-sheets', selectedClientId, selectedPeriodId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const res = await listLeadSheets(selectedClientId!, selectedPeriodId ?? undefined);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const unassignedQuery = useQuery({
    queryKey: ['lead-sheets-unassigned', selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const res = await listUnassignedAccounts(selectedClientId!);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const detailQuery = useQuery({
    queryKey: ['lead-sheets-period', selectedPeriodId],
    enabled: !!selectedPeriodId,
    queryFn: async () => {
      const res = await getPeriodLeadSheets(selectedPeriodId!);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const attachmentsQuery = useQuery({
    queryKey: ['lead-sheet-attachments', selectedPeriodId],
    enabled: !!selectedPeriodId,
    queryFn: async () => {
      const res = await listAttachments(selectedPeriodId!);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const tickmarksQuery = useQuery({
    queryKey: ['tickmarks', selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const res = await listTickmarks(selectedClientId!);
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['lead-sheets'] });
    qc.invalidateQueries({ queryKey: ['lead-sheet-attachments'] });
    qc.invalidateQueries({ queryKey: ['lead-sheets-unassigned'] });
    qc.invalidateQueries({ queryKey: ['lead-sheets-period'] });
  };

  const sheets = sheetsQuery.data ?? [];
  const unassigned = unassignedQuery.data ?? [];
  const details = detailQuery.data ?? [];

  const active = useMemo<LeadSheet | null>(
    () => sheets.find((s) => s.id === selectedId) ?? sheets[0] ?? null,
    [sheets, selectedId],
  );
  const activeDetail = useMemo<LeadSheetPeriodDetail | null>(
    () => (active ? details.find((d) => d.leadSheet.id === active.id) ?? null : null),
    [details, active],
  );

  const seedMutation = useMutation({
    mutationFn: () => seedLeadSheets(selectedClientId!),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      pushToast(res.data?.seeded ? `Created ${res.data.created} lead sheets.` : 'Lead sheets already exist.', 'success');
      invalidate();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createLeadSheet(selectedClientId!, { code: newCode.trim() || null, name: newName.trim() }),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      setShowAdd(false); setNewCode(''); setNewName('');
      invalidate();
    },
  });

  const renameMutation = useMutation({
    mutationFn: (id: number) => updateLeadSheet(id, { code: renameCode.trim() || null, name: renameName.trim() }),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      setRenamingId(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLeadSheet(id),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      const n = res.data?.orphanedAccounts ?? 0;
      pushToast(n > 0 ? `Deleted. ${n} account${n === 1 ? '' : 's'} moved to Unassigned.` : 'Lead sheet deleted.', 'success');
      setSelectedId(null);
      invalidate();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (order: Array<{ id: number; sortOrder: number }>) => reorderLeadSheets(selectedClientId!, order),
    onSuccess: () => invalidate(),
  });

  const assignMutation = useMutation({
    mutationFn: ({ accountId, leadSheetId }: { accountId: number; leadSheetId: number | null }) =>
      assignAccounts(selectedClientId!, [accountId], leadSheetId),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      invalidate();
    },
  });

  const signMutation = useMutation({
    mutationFn: ({ role }: { role: SignoffRole }) => signLeadSheet(selectedPeriodId!, active!.id, role),
    onMutate: ({ role }) => setBusyRole(role),
    onSettled: () => setBusyRole(null),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      invalidate();
    },
  });

  const unsignMutation = useMutation({
    mutationFn: ({ role }: { role: SignoffRole }) => unsignLeadSheet(selectedPeriodId!, active!.id, role),
    onMutate: ({ role }) => setBusyRole(role),
    onSettled: () => setBusyRole(null),
    onSuccess: (res) => {
      if (res.error) { pushToast(res.error.message, 'error'); return; }
      invalidate();
    },
  });

  const attachments = attachmentsQuery.data ?? [];
  const tickmarks = tickmarksQuery.data ?? [];
  const activeAttachments = useMemo(
    () => (active ? attachments.filter((a) => a.lead_sheet_id === active.id) : []),
    [attachments, active],
  );

  const handleUpload = async (file: File) => {
    if (!selectedPeriodId || !active) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      pushToast(`That file is too large. The limit is ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`, 'error');
      return;
    }
    setUploading(true);
    const res = await uploadAttachment(selectedPeriodId, file, { leadSheetId: active.id });
    setUploading(false);
    if (!res.ok) { pushToast(res.message, 'error'); return; }
    pushToast(`Attached as ${res.refCode}.`, 'success');
    invalidate();
  };

  const removeAttachment = async (a: LeadSheetAttachment) => {
    const ok = await confirmAction({
      message: `Remove ${a.ref_code} ("${a.source_file_name}")? The reference number stays reserved and is never reused.`,
      tone: 'danger',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    const res = await deleteAttachment(a.id);
    if (res.error) { pushToast(res.error.message, 'error'); return; }
    pushToast(`${a.ref_code} removed.`, 'success');
    invalidate();
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sheets.length) return;
    const reordered = [...sheets];
    const [item] = reordered.splice(index, 1);
    reordered.splice(target, 0, item);
    reorderMutation.mutate(reordered.map((s, i) => ({ id: s.id, sortOrder: i * 10 })));
  };

  if (!selectedClientId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">No client selected</p>
          <p className="text-sm mt-1">Choose a client to work its lead sheets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lead Sheets</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            {sheets.length} lead sheet{sheets.length === 1 ? '' : 's'}
            {unassigned.length > 0 && ` · ${unassigned.length} unassigned account${unassigned.length === 1 ? '' : 's'}`}
            {!selectedPeriodId && ' · select a period to see balances and sign off'}
          </p>
        </div>
        {sheets.length > 0 && (
          <button
            onClick={() => setShowAssign(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Auto-assign Accounts
          </button>
        )}
      </div>

      {sheetsQuery.isLoading ? (
        <div className="py-12 text-center text-gray-400 dark:text-gray-500">Loading…</div>
      ) : sheets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-10 text-center">
          <p className="text-base font-medium text-gray-900 dark:text-white">No lead sheets yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">
            Start from the standard A–O set, then rename, reorder or add your own.
          </p>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {seedMutation.isPending ? 'Creating…' : 'Create default lead sheets A–O'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-5">
          {/* ── Left rail ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {sheets.map((s, i) => {
                  const d = details.find((x) => x.leadSheet.id === s.id);
                  const isActive = active?.id === s.id;
                  return (
                    <li key={s.id}>
                      <div
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                          isActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-6">{s.code ?? '—'}</span>
                        <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{s.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{s.account_count ?? 0}</span>
                        {d && (
                          <span className="flex gap-1">
                            <SignBadge role="preparer" status={d.status.preparer} />
                            <SignBadge role="reviewer" status={d.status.reviewer} />
                          </span>
                        )}
                      </div>
                      {renamingId === s.id && (
                        <div className="px-3 pb-2 flex gap-1.5">
                          <input
                            value={renameCode}
                            onChange={(e) => setRenameCode(e.target.value)}
                            placeholder="Code"
                            className="w-14 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs dark:bg-gray-700 dark:text-white"
                          />
                          <input
                            value={renameName}
                            onChange={(e) => setRenameName(e.target.value)}
                            placeholder="Name"
                            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={() => renameMutation.mutate(s.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 px-1"
                          >
                            Save
                          </button>
                          <button onClick={() => setRenamingId(null)} className="text-xs text-gray-400 px-1">
                            Cancel
                          </button>
                        </div>
                      )}
                      {isActive && renamingId !== s.id && (
                        <div className="px-3 pb-2 flex items-center gap-3 text-xs">
                          <button
                            onClick={() => { setRenamingId(s.id); setRenameCode(s.code ?? ''); setRenameName(s.name); }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          >
                            Rename
                          </button>
                          <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-500 disabled:opacity-30 dark:text-gray-400">
                            ↑
                          </button>
                          <button onClick={() => move(i, 1)} disabled={i === sheets.length - 1} className="text-gray-500 disabled:opacity-30 dark:text-gray-400">
                            ↓
                          </button>
                          <button
                            onClick={async () => {
                              const n = s.account_count ?? 0;
                              const msg = n > 0
                                ? `Delete "${s.name}"? ${n} account${n === 1 ? '' : 's'} will move to Unassigned.`
                                : `Delete "${s.name}"?`;
                              if (await confirmAction({ message: msg, tone: 'danger', confirmLabel: 'Delete' })) {
                                deleteMutation.mutate(s.id);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 ml-auto"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                {showAdd ? (
                  <div className="flex gap-1.5">
                    <input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      placeholder="Code"
                      className="w-14 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Name"
                      autoFocus
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      onClick={() => newName.trim() && createMutation.mutate()}
                      className="text-xs text-blue-600 dark:text-blue-400 px-1"
                    >
                      Add
                    </button>
                    <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 px-1">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="w-full text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 py-1"
                  >
                    + Add lead sheet
                  </button>
                )}
              </div>
            </div>

            {/* Ungrouped */}
            {unassigned.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-800">
                  <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                    Unassigned ({unassigned.length})
                  </h3>
                </div>
                <ul className="max-h-72 overflow-y-auto divide-y divide-amber-100 dark:divide-amber-900/40">
                  {unassigned.map((a) => (
                    <li key={a.id} className="px-3 py-2">
                      <div className="text-xs font-mono text-gray-600 dark:text-gray-400">{a.account_number}</div>
                      <div className="text-sm text-gray-900 dark:text-white truncate">{a.account_name}</div>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) assignMutation.mutate({ accountId: a.id, leadSheetId: Number(v) });
                        }}
                        className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Assign…</option>
                        {sheets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code ? `${s.code} — ` : ''}{s.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Right pane ────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {!active ? (
              <div className="p-10 text-center text-gray-400 dark:text-gray-500">Select a lead sheet.</div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">{active.code ?? '—'}</span>
                    {active.name}
                  </h3>
                  {selectedPeriodId && activeDetail && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <SignoffControl
                        role="preparer"
                        detail={activeDetail}
                        busy={busyRole === 'preparer'}
                        onSign={(role) => signMutation.mutate({ role })}
                        onUnsign={(role) => unsignMutation.mutate({ role })}
                      />
                      <SignoffControl
                        role="reviewer"
                        detail={activeDetail}
                        busy={busyRole === 'reviewer'}
                        onSign={(role) => signMutation.mutate({ role })}
                        onUnsign={(role) => unsignMutation.mutate({ role })}
                      />
                    </div>
                  )}
                </div>

                {activeDetail && (activeDetail.status.preparer === 'stale' || activeDetail.status.reviewer === 'stale') && (
                  <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-400">
                    Signed before subsequent changes — the balances behind this lead sheet moved after the signature. Review and re-sign.
                  </div>
                )}

                {!selectedPeriodId ? (
                  <div className="p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
                    Select a period to see balances, tickmarks and sign-off.
                  </div>
                ) : !activeDetail || activeDetail.rows.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
                    No accounts with activity on this lead sheet for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Acct #</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Account</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Prior Year</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Unadjusted</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Book Adj</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Book Bal</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Tax Bal</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Marks</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">W/P Ref</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {activeDetail.rows.map((r) => (
                          <tr key={r.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{r.account_number}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-white">{r.account_name}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {fmt(net(r, r.prior_year_debit, r.prior_year_credit))}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {fmt(net(r, r.unadjusted_debit, r.unadjusted_credit))}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {fmt(net(r, r.book_adj_debit, r.book_adj_credit))}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">
                              {fmt(net(r, r.book_adjusted_debit, r.book_adjusted_credit))}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {fmt(net(r, r.tax_adjusted_debit, r.tax_adjusted_credit))}
                            </td>
                            <td className="px-3 py-2">
                              <span className="flex flex-wrap gap-1">
                                {r.tickmarks.map((t) => (
                                  <span
                                    key={t.id}
                                    title={t.description}
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                                      TICKMARK_COLOR_CLASSES[t.color as TickmarkColor] ?? TICKMARK_COLOR_CLASSES.gray
                                    }`}
                                  >
                                    {t.symbol}
                                  </span>
                                ))}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{r.workpaper_ref ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 font-semibold">
                          <td className="px-3 py-2" colSpan={2}>
                            Total {active.code ? `${active.code} — ` : ''}{active.name}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                            {fmt(activeDetail.rows.reduce((s, r) => s + net(r, r.prior_year_debit, r.prior_year_credit), 0))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                            {fmt(activeDetail.rows.reduce((s, r) => s + net(r, r.unadjusted_debit, r.unadjusted_credit), 0))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                            {fmt(activeDetail.rows.reduce((s, r) => s + net(r, r.book_adj_debit, r.book_adj_credit), 0))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                            {fmt(activeDetail.rows.reduce((s, r) => s + net(r, r.book_adjusted_debit, r.book_adjusted_credit), 0))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                            {fmt(activeDetail.rows.reduce((s, r) => s + net(r, r.tax_adjusted_debit, r.tax_adjusted_credit), 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* ── Supporting files ─────────────────────────────────── */}
                {selectedPeriodId && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Supporting files ({activeAttachments.length})
                      </h4>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_ATTACHMENT_TYPES}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUpload(f);
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300 disabled:opacity-50"
                        >
                          {uploading ? 'Uploading…' : '+ Attach file'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      PDF, PNG or JPEG. Images are converted to PDF so every attachment can carry
                      tickmarks. Files are named automatically —{' '}
                      <span className="font-mono">{active.code ?? 'LS'}001</span>, and so on.
                    </p>
                    {activeAttachments.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">Nothing attached to this lead sheet yet.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {activeAttachments.map((a) => (
                          <li key={a.id} className="py-2 flex items-center gap-3">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                              {a.ref_code}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{a.source_file_name}</span>
                            {a.annotations?.length > 0 && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {a.annotations.length} mark{a.annotations.length === 1 ? '' : 's'}
                              </span>
                            )}
                            <button onClick={() => setViewing(a)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                              View &amp; stamp
                            </button>
                            <button onClick={() => void removeAttachment(a)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {viewing && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 text-white text-sm">Loading viewer…</div>}>
          <LeadSheetPdfViewer
            attachment={viewing}
            tickmarks={tickmarks}
            onClose={() => setViewing(null)}
            onStamped={invalidate}
          />
        </Suspense>
      )}

      {showAssign && selectedClientId && (
        <LeadSheetAssignmentModal
          clientId={selectedClientId}
          leadSheets={sheets}
          onClose={() => setShowAssign(false)}
          onApplied={() => { setShowAssign(false); invalidate(); }}
        />
      )}
    </div>
  );
}
