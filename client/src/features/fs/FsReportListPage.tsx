// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Statement Writer — the client's statement sets, across all of its periods.
// A set belongs to one period; "New statements" starts one for the period
// selected in the sidebar.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FS_ENTITY_KINDS, type FsColumnsConfig, type FsEntityKind, type FsFramework } from '../../lib/fsEngine';
import { fsApi, fsErrorMessage, type FsReportListItem } from '../../api/fs';
import { listPeriods, type Period } from '../../api/periods';
import { useAuthStore, useUIStore, pushToast } from '../../store/uiStore';
import { confirmAction } from '../../components/ConfirmDialog';
import { RefreshButton } from '../../components/RefreshButton';
import { Spinner } from '../../components/Spinner';
import { ENTITY_LABEL, FsColumnsPicker } from './FsEditorPage';
import { Badge, Btn, ErrorBox, Field, Modal, inputCls } from './ui';

export const FRAMEWORK_LABEL: Record<FsFramework, string> = {
  gaap: 'GAAP',
  cash: 'Cash basis',
  tax: 'Income tax basis',
};

const fmtDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString() : '');

export function FsReportListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { selectedClientId, selectedPeriodId } = useUIStore();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role !== 'reviewer';
  const [creating, setCreating] = useState(false);
  const [rolling, setRolling] = useState<FsReportListItem | null>(null);

  const reportsQ = useQuery({
    // 'fs-reports' is in BALANCE_DEPENDENTS: the stale badges follow the balances.
    queryKey: ['fs-reports', selectedClientId],
    queryFn: () => fsApi.reports(selectedClientId!),
    enabled: !!selectedClientId,
  });
  const periodsQ = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => { const r = await listPeriods(selectedClientId!); if (r.error) throw new Error(r.error.message); return r.data; },
    enabled: !!selectedClientId,
  });
  const period = periodsQ.data?.find((p) => p.id === selectedPeriodId) ?? null;

  const archiveM = useMutation({
    mutationFn: (id: number) => fsApi.archiveReport(id),
    onSuccess: () => { pushToast('Archived', 'success'); return qc.invalidateQueries({ queryKey: ['fs-reports'] }); },
    onError: (e) => pushToast(fsErrorMessage(e, 'Archive failed'), 'error'),
  });

  if (!selectedClientId) {
    return <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Select a client to prepare financial statements.</div>;
  }
  const reports = reportsQ.data?.reports ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Statement Writer<RefreshButton /></h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Report-ready statements built on the client&apos;s lead sheets — balance sheet, income statement, equity, cash flows and supporting schedules,
            with a cover, the accountant&apos;s report and a PDF, Word or Excel copy.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/fs-library"><Btn variant="secondary">Statement library</Btn></Link>
          {canWrite && (
            <Btn onClick={() => setCreating(true)} disabled={!period} title={period ? undefined : 'Select a period in the sidebar first'}>New statements</Btn>
          )}
        </div>
      </div>

      {reportsQ.isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : reportsQ.isError ? (
        <ErrorBox>{fsErrorMessage(reportsQ.error, 'Could not load the statement sets.')} <button className="underline" onClick={() => reportsQ.refetch()}>Retry</button></ErrorBox>
      ) : !reports.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
          <p className="text-gray-700 dark:text-gray-200 font-medium">No financial statements yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {period ? `Start a set for ${period.period_name} from the built-in layout or one of your firm's templates.` : 'Select a period in the sidebar, then start a set.'}
          </p>
          {canWrite && period && <Btn className="mt-4" onClick={() => setCreating(true)}>New statements</Btn>}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Basis</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {reports.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${r.periodId === selectedPeriodId ? '' : 'text-gray-500'}`} onClick={() => navigate(`/statement-writer/${r.id}`)}>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300" title={`${fmtDate(r.periodStart)} – ${fmtDate(r.periodEnd)}`}>
                    {r.periodName}{r.periodId === selectedPeriodId && <span className="ml-1 text-xs text-gray-400">(selected)</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{FRAMEWORK_LABEL[r.framework]}{r.columns.mode === 'cy_py' ? ' · comparative' : ''}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.status === 'final' && r.currentVersion
                        ? <Badge tone="green">Final v{r.currentVersion.versionNo}</Badge>
                        : <Badge tone="gray">Draft</Badge>}
                      {r.status === 'final' && r.currentVersion?.stale && (
                        <Badge tone="amber" title="The trial balance changed after these statements were finalized">Balances changed</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {canWrite && (
                      <>
                        <button className="px-2 py-1 text-xs text-blue-700 dark:text-blue-400 hover:underline" onClick={() => setRolling(r)}>Roll forward</button>
                        <button className="px-2 py-1 text-xs text-red-600 hover:underline" onClick={async () => {
                          const ok = await confirmAction({
                            title: 'Archive these statements?', confirmLabel: 'Archive', tone: 'danger',
                            message: `"${r.name}" will disappear from this list. Its finalized versions are kept.`,
                          });
                          if (ok) archiveM.mutate(r.id);
                        }}>Archive</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && period && (
        <NewStatementsDialog clientId={selectedClientId} period={period} onClose={() => setCreating(false)}
          onCreated={(id) => { void qc.invalidateQueries({ queryKey: ['fs-reports'] }); navigate(`/statement-writer/${id}`); }} />
      )}
      {rolling && (
        <RollForwardDialog report={rolling} periods={periodsQ.data ?? []} onClose={() => setRolling(null)}
          onDone={(id) => { void qc.invalidateQueries({ queryKey: ['fs-reports'] }); navigate(`/statement-writer/${id}`); }} />
      )}
    </div>
  );
}

function RollForwardDialog({ report, periods, onClose, onDone }: { report: FsReportListItem; periods: Period[]; onClose: () => void; onDone: (id: number) => void }) {
  // The period right after this one, when the client has it.
  const others = periods.filter((p) => p.id !== report.periodId).sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''));
  const next = others.find((p) => (p.end_date ?? '') > (report.periodEnd ?? '')) ?? others[others.length - 1];
  const [periodId, setPeriodId] = useState<number | ''>(next?.id ?? '');
  const m = useMutation({
    mutationFn: () => fsApi.rollForward(report.id, Number(periodId)),
    onSuccess: (r) => onDone(r.report.id),
    onError: (e) => pushToast(fsErrorMessage(e, 'Roll forward failed'), 'error'),
  });
  return (
    <Modal title="Roll these statements forward" footer={(
      <>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!periodId} busy={m.isPending} onClick={() => m.mutate()}>Create draft</Btn>
      </>
    )}>
      <p>
        Starts a new draft of &ldquo;{report.name}&rdquo; in another period, on the same layout, basis and columns. The report date and any
        wording customized for this year are not carried.
      </p>
      {others.length ? (
        <Field label="Period">
          <select className={inputCls} value={periodId} onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : '')}>
            {others.map((p) => <option key={p.id} value={p.id}>{p.period_name}</option>)}
          </select>
        </Field>
      ) : (
        <p className="text-amber-700 dark:text-amber-400">This client has no other period. Roll the period forward on the Periods page first.</p>
      )}
    </Modal>
  );
}

type Source = { kind: 'default' } | { kind: 'client_layout'; id: number } | { kind: 'template'; id: number };

function NewStatementsDialog({ clientId, period, onClose, onCreated }: { clientId: number; period: Period; onClose: () => void; onCreated: (id: number) => void }) {
  const libraryQ = useQuery({ queryKey: ['fs-library'], queryFn: fsApi.library });
  const layoutsQ = useQuery({ queryKey: ['fs-layouts', clientId], queryFn: () => fsApi.layouts(clientId) });
  const year = (period.end_date ?? '').slice(0, 4);
  const [name, setName] = useState('');
  const [framework, setFramework] = useState<FsFramework>('gaap');
  const [entityKind, setEntityKind] = useState<FsEntityKind | ''>('');
  const [columns, setColumns] = useState<FsColumnsConfig>({ mode: 'cy_py', pctOfRevenue: false, varianceAmt: false, variancePct: false });
  const [source, setSource] = useState<Source>({ kind: 'default' });
  const [presetId, setPresetId] = useState('');
  const [resolutions, setResolutions] = useState<Record<string, string | null>>({});

  // What would not bind, for the built-in layout or the chosen template.
  const templateId = source.kind === 'template' ? source.id : null;
  const bindQ = useQuery({
    queryKey: ['fs-bind-preview', clientId, templateId],
    queryFn: () => fsApi.bindPreview(clientId, templateId),
    enabled: source.kind !== 'client_layout',
  });
  const unresolved = source.kind === 'client_layout' ? [] : bindQ.data?.unresolved ?? [];
  const noLeadSheets = bindQ.data ? bindQ.data.groupings.length === 0 : false;
  const datesMissing = !period.start_date || !period.end_date;

  const createM = useMutation({
    mutationFn: () => fsApi.createReport(period.id, {
      name: name.trim() || `Financial Statements${year ? ` ${year}` : ''}`,
      settings: { framework, columns, entityKind: entityKind || null },
      layoutSource: source.kind === 'client_layout'
        ? { kind: 'client_layout', clientLayoutId: source.id }
        : source.kind === 'template'
          ? { kind: 'template', templateId: source.id, resolutions }
          : { kind: 'default' },
      stylePresetId: presetId ? Number(presetId) : null,
    }),
    onSuccess: (r) => onCreated(r.report.id),
    onError: (e) => pushToast(fsErrorMessage(e, 'Could not create the statements'), 'error'),
  });

  const pick = (s: Source) => { setSource(s); setResolutions({}); };
  const radio = 'flex items-center gap-2 text-gray-700 dark:text-gray-200';

  return (
    <Modal wide title={`New financial statements — ${period.period_name}`} footer={(
      <>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => createM.mutate()} busy={createM.isPending} disabled={datesMissing}>Create</Btn>
      </>
    )}>
      {datesMissing && (
        <ErrorBox>This period has no start and end date yet. Set them on the <Link className="underline" to="/periods">Periods</Link> page — the statements are headed by them.</ErrorBox>
      )}
      {noLeadSheets && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3 text-amber-800 dark:text-amber-300">
          This client has no lead sheets yet. Statements are built on them: set them up and assign the accounts on the{' '}
          <Link className="underline" to="/lead-sheets">Lead Sheets</Link> page first.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name"><input className={inputCls} placeholder={`Financial Statements${year ? ` ${year}` : ''}`} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Reporting basis" hint={framework === 'tax' ? 'Uses the tax-adjusted balances' : 'Uses the book-adjusted balances'}>
          <select className={inputCls} value={framework} onChange={(e) => setFramework(e.target.value as FsFramework)}>
            <option value="gaap">GAAP (book)</option>
            <option value="cash">Cash basis (book)</option>
            <option value="tax">Income tax basis</option>
          </select>
        </Field>
        <Field label="Entity" hint="Sets the equity wording and the equity statement's columns">
          <select className={inputCls} value={entityKind} onChange={(e) => setEntityKind(e.target.value as FsEntityKind | '')}>
            <option value="">From the client&apos;s entity type</option>
            {FS_ENTITY_KINDS.map((k) => <option key={k} value={k}>{ENTITY_LABEL[k]}</option>)}
          </select>
        </Field>
      </div>
      <div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Columns</span>
        <div className="mt-1"><FsColumnsPicker value={columns} onChange={setColumns} /></div>
        {columns.mode === 'cy_py' && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">The prior year comes from this period&apos;s prior-year balances.</p>}
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-gray-600 dark:text-gray-400">Layout</legend>
        <div className="mt-1 space-y-1">
          <label className={radio}><input type="radio" name="fs-source" checked={source.kind === 'default'} onChange={() => pick({ kind: 'default' })} />Built-in layout (from the lead sheets A–O)</label>
          {(layoutsQ.data?.layouts ?? []).map((l) => (
            <label key={`c${l.id}`} className={radio}><input type="radio" name="fs-source" checked={source.kind === 'client_layout' && source.id === l.id} onChange={() => pick({ kind: 'client_layout', id: l.id })} />This client&apos;s layout: {l.name}</label>
          ))}
          {(libraryQ.data?.templates ?? []).map((t) => (
            <label key={`t${t.id}`} className={radio}><input type="radio" name="fs-source" checked={source.kind === 'template' && source.id === t.id} onChange={() => pick({ kind: 'template', id: t.id })} />Firm template: {t.name}</label>
          ))}
        </div>
        {unresolved.length > 0 && !noLeadSheets && (
          <div className="mt-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3">
            <p className="text-amber-800 dark:text-amber-300 font-medium">
              {source.kind === 'template' ? "Match these template lines to this client's lead sheets" : 'These lines of the built-in layout have no matching lead sheet for this client'}
            </p>
            <div className="mt-2 space-y-1.5">
              {unresolved.map((u) => (
                <div key={u.nodeId} className="flex items-center gap-2">
                  <span className="w-48 truncate text-gray-800 dark:text-gray-100">{u.caption}{u.leadsheetCode ? ` (${u.leadsheetCode})` : ''}</span>
                  {source.kind === 'template' ? (
                    <select className={inputCls} aria-label={`Lead sheet for ${u.caption}`} value={resolutions[u.nodeId] === null ? '__drop' : resolutions[u.nodeId] ?? ''}
                      onChange={(e) => setResolutions((r) => {
                        const nextRes = { ...r };
                        if (e.target.value === '') delete nextRes[u.nodeId];
                        else nextRes[u.nodeId] = e.target.value === '__drop' ? null : e.target.value;
                        return nextRes;
                      })}>
                      <option value="">Leave unlinked (shows as an issue)</option>
                      <option value="__drop">Remove this line</option>
                      {(bindQ.data?.groupings ?? []).map((g) => <option key={g.id} value={g.id}>{g.code ? `${g.code} — ` : ''}{g.name}</option>)}
                    </select>
                  ) : <span className="text-xs text-amber-800 dark:text-amber-300">link or remove it in the editor</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {source.kind !== 'client_layout' && (
        <Field label="Style">
          <select className={inputCls} value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            <option value="">Firm default</option>
            {(libraryQ.data?.presets ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
          </select>
        </Field>
      )}
    </Modal>
  );
}
