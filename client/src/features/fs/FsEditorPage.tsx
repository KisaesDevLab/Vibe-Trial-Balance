// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Statement Writer editor: a settings bar, left-hand panels (statements
// outline, style, front matter, classification, checks) and a paginated
// preview computed IN THE BROWSER with the same engine and renderer the
// server uses for the PDF (lib/fsEngine is a generated copy of
// server/src/lib/fs/engine). Save persists the layout and style — which
// belong to the CLIENT and are shared by all of its statement sets — and
// this set's own settings. Finalize freezes a version.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  computeFsReport, fsPreviewDocument, FS_ENTITY_KINDS,
  type FsCheck, type FsColumnsConfig, type FsEntityKind, type FsFrontMatter, type FsLayout, type FsRenderedReport,
  type FsReportSettings, type FsStatementConfig, type FsStyle,
} from '../../lib/fsEngine';
import {
  downloadFsExport, fetchFsPreviewPdf, finalizeChecks, fsApi, fsErrorMessage, FS_FONT_BASE_URL, FsApiError,
  type FsDraft, type FsReportDetail, type FsVersion,
} from '../../api/fs';
import { useAuthStore, pushToast } from '../../store/uiStore';
import { RefreshButton } from '../../components/RefreshButton';
import { Spinner } from '../../components/Spinner';
import { useUnsavedGuard } from '../../utils/useUnsavedGuard';
import { FsOutlinePanel } from './FsOutlinePanel';
import { CashFlowPanel, ChecksPanel, EquityRolesPanel, FrontMatterPanel, StatementSettingsPanel, StylePanel } from './FsPanels';
import { FsLivePreview, FsPdfProof, type PdfProofState } from './FsPreview';
import { Badge, Btn, ErrorBox, Modal, Section, inputCls, linkCls } from './ui';

type Tab = 'statements' | 'style' | 'front' | 'classify' | 'checks';

const STATEMENT_NAME: Record<FsStatementConfig['kind'], string> = {
  balance_sheet: 'Balance sheet', income_statement: 'Income statement', equity: 'Equity', cash_flows: 'Cash flows',
};
export const ENTITY_LABEL: Record<FsEntityKind, string> = {
  corporation: 'Corporation', partnership: 'Partnership', llc: 'LLC', sole_prop: 'Sole proprietor',
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function FsColumnsPicker({ value, onChange, disabled }: { value: FsColumnsConfig; onChange: (v: FsColumnsConfig) => void; disabled?: boolean }) {
  const box = 'inline-flex items-center gap-1 text-gray-700 dark:text-gray-300';
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <select className={`${inputCls} !w-auto`} value={value.mode} disabled={disabled} aria-label="Columns"
        onChange={(e) => {
          const mode = e.target.value as FsColumnsConfig['mode'];
          // $ and % change need two columns to compare.
          onChange({ ...value, mode, ...(mode === 'single' ? { varianceAmt: false, variancePct: false } : {}) });
        }}>
        <option value="single">This period</option>
        <option value="cy_py">This period and prior year</option>
      </select>
      <label className={box}><input type="checkbox" disabled={disabled} checked={value.pctOfRevenue} onChange={(e) => onChange({ ...value, pctOfRevenue: e.target.checked })} />% of revenue</label>
      {value.mode === 'cy_py' && (
        <>
          <label className={box}><input type="checkbox" disabled={disabled} checked={value.varianceAmt} onChange={(e) => onChange({ ...value, varianceAmt: e.target.checked })} />$ change</label>
          <label className={box}><input type="checkbox" disabled={disabled} checked={value.variancePct} onChange={(e) => onChange({ ...value, variancePct: e.target.checked })} />% change</label>
        </>
      )}
    </span>
  );
}

export function FsEditorPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const id = Number(reportId);
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  // Reviewer accounts are read-only at the API boundary; do not offer what would be refused.
  const isReviewer = role === 'reviewer';

  const detailQ = useQuery({ queryKey: ['fs-report', id], queryFn: () => fsApi.report(id), enabled: Number.isInteger(id) && id > 0 });
  const detail = detailQ.data;
  const libraryQ = useQuery({ queryKey: ['fs-library'], queryFn: fsApi.library });
  const clientId = detail?.report.clientId;
  const cashFlowQ = useQuery({ queryKey: ['fs-cash-flow', clientId], queryFn: () => fsApi.cashFlow(clientId!), enabled: !!clientId });
  const equityQ = useQuery({ queryKey: ['fs-equity-roles', clientId], queryFn: () => fsApi.equityRoles(clientId!), enabled: !!clientId });

  const [name, setName] = useState('');
  const [layout, setLayout] = useState<FsLayout | null>(null);
  const [style, setStyle] = useState<FsStyle | null>(null);
  const [settings, setSettings] = useState<FsReportSettings | null>(null);
  const [frontMatter, setFrontMatter] = useState<FsFrontMatter | null>(null);
  const [dirtyLayout, setDirtyLayout] = useState(false);
  const [dirtyReport, setDirtyReport] = useState(false);
  const [tab, setTab] = useState<Tab>('statements');
  const [stmtId, setStmtId] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [view, setView] = useState<'live' | 'pdf'>('live');
  const [pdf, setPdf] = useState<PdfProofState>({ blob: null, loading: false, error: null });
  const [finalizeDlg, setFinalizeDlg] = useState<{ checks: FsCheck[] } | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Take the server's state when it arrives — unless there are unsaved edits,
  // which a background refetch (tab focus, the 30 s stale window) must never
  // overwrite. Saving clears the dirty flags first, so the post-save refetch
  // lands here and refreshes `updatedAt` for the next optimistic save.
  useEffect(() => {
    if (!detail || dirtyLayout || dirtyReport) return;
    setName(detail.report.name);
    setLayout(detail.layout.layout);
    setStyle(detail.layout.style);
    setSettings(detail.report.settings);
    setFrontMatter(detail.report.frontMatter);
    setStmtId((cur) => cur || detail.layout.layout.statements[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const dirty = dirtyLayout || dirtyReport;
  useUnsavedGuard(dirty);

  const isFinal = detail?.report.status === 'final';
  const readOnly = isFinal || isReviewer;

  // The source depends on the basis and entity kind, and the letter on the
  // front matter; debounce both so typing does not refetch per keystroke.
  const debSettings = useDebounced(settings, 400);
  const debFront = useDebounced(frontMatter, 600);
  const previewKeyDraft = useMemo(() => {
    if (!detail || !debSettings || !debFront) return null;
    const same = JSON.stringify(debSettings) === JSON.stringify(detail.report.settings)
      && JSON.stringify(debFront) === JSON.stringify(detail.report.frontMatter);
    return same ? undefined : ({ settings: debSettings, frontMatter: debFront } satisfies FsDraft);
  }, [detail, debSettings, debFront]);
  const previewQ = useQuery({
    // 'fs-preview-data' is in BALANCE_DEPENDENTS: a balance edit elsewhere refetches it.
    queryKey: ['fs-preview-data', id, previewKeyDraft ? JSON.stringify(previewKeyDraft) : 'saved'],
    queryFn: () => fsApi.previewData(id, previewKeyDraft ?? undefined),
    enabled: previewKeyDraft !== null,
    placeholderData: (prev) => prev,
  });

  const computed = useMemo((): { model: FsRenderedReport | null; error: string | null } => {
    if (!layout || !style || !settings || !previewQ.data) return { model: null, error: null };
    try {
      return { model: computeFsReport(settings, layout, style, previewQ.data.source), error: null };
    } catch (e) {
      return { model: null, error: fsErrorMessage(e, 'Could not compute the statements') };
    }
  }, [layout, style, settings, previewQ.data]);

  const html = useMemo(() => {
    if (!computed.model || !style || !frontMatter) return '';
    return fsPreviewDocument({
      report: computed.model, style, frontMatter,
      letterhead: previewQ.data?.letterhead ?? null, letter: previewQ.data?.letter ?? null,
      fonts: { mode: 'url', baseUrl: FS_FONT_BASE_URL },
    });
  }, [computed.model, style, frontMatter, previewQ.data]);

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['fs-report', id] }),
      qc.invalidateQueries({ queryKey: ['fs-reports'] }),
      qc.invalidateQueries({ queryKey: ['fs-preview-data', id] }),
    ]);
  };

  const save = async (): Promise<boolean> => {
    if (!detail || !layout || !style || !settings || !frontMatter) return false;
    if (!dirty) return true;
    setSaving(true);
    try {
      if (dirtyLayout) {
        await fsApi.saveLayout(detail.layout.id, { layout, style, expectedUpdatedAt: detail.layout.updatedAt ?? undefined });
        setDirtyLayout(false);
      }
      if (dirtyReport) {
        await fsApi.updateReport(id, { name: name.trim() || detail.report.name, settings, frontMatter });
        setDirtyReport(false);
      }
      await refreshAll();
      return true;
    } catch (e) {
      pushToast(fsErrorMessage(e, 'Save failed'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const finalizeM = useMutation({
    mutationFn: (override?: { reason: string }) => fsApi.finalize(id, override ? { overrideValidation: true, reason: override.reason } : {}),
  });
  const doFinalize = async (override?: { reason: string }) => {
    if (!(await save())) return;
    try {
      const r = await finalizeM.mutateAsync(override);
      setFinalizeDlg(null);
      pushToast(`Finalized as version ${r.versionNo} (${r.pageCount} pages)`, 'success');
      if (r.periodUnlocked) pushToast('This period is not locked: a later change to its balances will mark these statements stale.', 'info');
      await refreshAll();
    } catch (e) {
      const failing = finalizeChecks(e);
      if (failing) setFinalizeDlg({ checks: failing });
      else pushToast(fsErrorMessage(e, 'Finalize failed'), 'error');
    }
  };

  const reopenM = useMutation({
    mutationFn: () => fsApi.reopen(id),
    onSuccess: async () => { pushToast('Reopened — finalizing again creates a new version', 'info'); await refreshAll(); },
    onError: (e) => pushToast(fsErrorMessage(e, 'Reopen failed'), 'error'),
  });

  const current = detail?.versions.find((v) => v.status === 'final') ?? null;

  const doExport = async (format: 'pdf' | 'docx' | 'xlsx') => {
    setExportOpen(false);
    if (!isFinal && !isReviewer && !(await save())) return;
    try {
      await downloadFsExport(id, format, isFinal && current ? current.versionNo : null);
    } catch (e) {
      pushToast(fsErrorMessage(e, 'Download failed'), 'error');
    }
  };

  const loadPdf = async () => {
    if (!layout || !style || !settings || !frontMatter) return;
    setPdf({ blob: null, loading: true, error: null });
    try {
      // Unsaved edits are sent along; with none it is a plain GET (which a reviewer may call).
      const blob = await fetchFsPreviewPdf(id, dirty && !isReviewer ? { layout, style, settings, frontMatter } : undefined);
      setPdf({ blob, loading: false, error: null });
    } catch (e) {
      setPdf({ blob: null, loading: false, error: fsErrorMessage(e, 'Could not render the PDF') });
    }
  };

  const saveClassification = async (work: () => Promise<unknown>) => {
    try {
      await work();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fs-cash-flow', clientId] }),
        qc.invalidateQueries({ queryKey: ['fs-equity-roles', clientId] }),
        qc.invalidateQueries({ queryKey: ['fs-preview-data'] }),
      ]);
    } catch (e) {
      pushToast(fsErrorMessage(e, 'Save failed'), 'error');
    }
  };

  if (!Number.isInteger(id) || id <= 0) return <div className="p-6"><ErrorBox>That is not a statement set.</ErrorBox></div>;
  if (detailQ.isError) {
    return (
      <div className="p-6">
        <ErrorBox>
          {fsErrorMessage(detailQ.error, 'Could not load these statements.')}{' '}
          <button className="underline" onClick={() => detailQ.refetch()}>Retry</button>{' · '}
          <Link className="underline" to="/statement-writer">Back to the list</Link>
        </ErrorBox>
      </div>
    );
  }
  if (!detail || !layout || !style || !settings || !frontMatter) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const statement = layout.statements.find((s) => s.id === stmtId) ?? layout.statements[0]!;
  const setStatement = (next: FsStatementConfig) => {
    setLayout({ ...layout, statements: layout.statements.map((s) => (s.id === next.id ? next : s)) });
    setDirtyLayout(true);
  };
  const moveStatement = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= layout.statements.length) return;
    const list = [...layout.statements];
    [list[i], list[j]] = [list[j]!, list[i]!];
    setLayout({ ...layout, statements: list });
    setDirtyLayout(true);
  };
  const setS = (p: Partial<FsReportSettings>) => { setSettings({ ...settings, ...p }); setDirtyReport(true); };
  const setSchedules = (p: Partial<FsLayout['schedules']>) => { setLayout({ ...layout, schedules: { ...layout.schedules, ...p } }); setDirtyLayout(true); };
  const checks = computed.model?.checks ?? [];
  const errorCount = checks.filter((c) => c.severity === 'error').length;
  const previewError = previewQ.isError ? fsErrorMessage(previewQ.error, 'Could not load the balances.') : null;

  const tabs: Array<[Tab, string]> = [
    ['statements', 'Statements'], ['style', 'Style'], ['front', 'Report'], ['classify', 'Classify'],
    ['checks', `Checks${checks.length ? ` (${checks.length})` : ''}`],
  ];
  const seg = (on: boolean) => `rounded px-2 py-0.5 text-xs ${on ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'}`;

  return (
    // Fills the app shell's content area; the two columns scroll on their own.
    <div className="flex flex-col h-full min-h-0">
      {/* Header / settings bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/statement-writer" className="px-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Back to the list" title="Back to the list">←</Link>
          <h1 className="flex items-center min-w-0 flex-1 max-w-md">
            <input className="text-lg font-semibold text-gray-900 dark:text-white bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded px-1 py-0.5 min-w-0 flex-1 disabled:hover:border-transparent"
              value={name} disabled={readOnly} onChange={(e) => { setName(e.target.value); setDirtyReport(true); }} aria-label="Statement set name" />
            <RefreshButton />
          </h1>
          {isFinal && current && <Badge tone="green">Final v{current.versionNo}</Badge>}
          {isFinal && current?.stale && <StaleBadge reportId={id} versionNo={current.versionNo} />}
          <div className="ml-auto flex items-center gap-2">
            {!readOnly && <Btn small variant="secondary" onClick={() => save()} disabled={!dirty} busy={saving}>{dirty ? 'Save' : 'Saved'}</Btn>}
            <div className="relative">
              <Btn small variant="secondary" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen}>Download ▾</Btn>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-lg z-20">
                  {(['pdf', 'docx', 'xlsx'] as const).map((f) => (
                    <button key={f} className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => doExport(f)}>
                      {{ pdf: 'PDF', docx: 'Word (.docx)', xlsx: 'Excel (.xlsx)' }[f]}{isFinal ? '' : ' — draft'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Btn small variant="secondary" onClick={() => setVersionsOpen(true)}>Versions{detail.versions.length ? ` (${detail.versions.length})` : ''}</Btn>
            {!isReviewer && (isFinal
              ? <Btn small variant="secondary" busy={reopenM.isPending} onClick={() => reopenM.mutate()}>Reopen</Btn>
              : <Btn small busy={finalizeM.isPending || saving} onClick={() => doFinalize()}>Finalize</Btn>)}
          </div>
        </div>
        <fieldset disabled={readOnly} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
          <span title={`${detail.period.start} to ${detail.period.end}`}>
            <span className="text-gray-500 dark:text-gray-400">Period</span> <span className="font-medium text-gray-900 dark:text-white">{detail.period.name}</span>
            {detail.period.locked && <span className="ml-1 text-xs text-gray-400">(locked)</span>}
          </span>
          <label className="flex items-center gap-1.5">Basis
            <select className={`${inputCls} !w-auto`} value={settings.framework} onChange={(e) => setS({ framework: e.target.value as FsReportSettings['framework'] })}>
              <option value="gaap">GAAP (book)</option>
              <option value="cash">Cash basis (book)</option>
              <option value="tax">Income tax basis</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">Entity
            <select className={`${inputCls} !w-auto`} value={settings.entityKind ?? ''} onChange={(e) => setS({ entityKind: (e.target.value || null) as FsEntityKind | null })}>
              <option value="">{ENTITY_LABEL[detail.defaultEntityKind]} (from the client)</option>
              {FS_ENTITY_KINDS.map((k) => <option key={k} value={k}>{ENTITY_LABEL[k]}</option>)}
            </select>
          </label>
          <span className="flex items-center gap-1.5">Columns
            <FsColumnsPicker value={settings.columns} disabled={readOnly} onChange={(columns) => setS({ columns })} />
          </span>
        </fieldset>
      </div>

      {isFinal && (
        <div className="bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 px-4 py-1.5 text-xs text-green-800 dark:text-green-300">
          These statements are final and locked. The numbers, layout and PDF are frozen as version {current?.versionNo}. Reopen to make changes; finalizing again creates a new version.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-[440px] shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col min-h-0">
          <div className="flex border-b border-gray-200 dark:border-gray-700" role="tablist">
            {tabs.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`flex-1 px-2 py-2 text-xs font-medium ${tab === k ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'} ${k === 'checks' && errorCount ? '!text-red-600' : ''}`}>{l}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tab === 'statements' && (
              <>
                <div className="space-y-1">
                  {layout.statements.map((s, i) => (
                    <div key={s.id}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer ${s.id === statement.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'}`}
                      onClick={() => { setStmtId(s.id); setSelectedNode(null); }}>
                      <span className={`flex-1 ${s.enabled ? '' : 'line-through text-gray-400'}`}>{STATEMENT_NAME[s.kind]}</span>
                      {!readOnly && (
                        <>
                          <button type="button" className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Move up" title="Move up" onClick={(e) => { e.stopPropagation(); moveStatement(i, -1); }}>↑</button>
                          <button type="button" className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Move down" title="Move down" onClick={(e) => { e.stopPropagation(); moveStatement(i, 1); }}>↓</button>
                        </>
                      )}
                    </div>
                  ))}
                  <label className="flex items-center gap-2 px-2 pt-1 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" disabled={readOnly} checked={layout.schedules.enabled} onChange={(e) => setSchedules({ enabled: e.target.checked })} />
                    Supporting schedules (Supplementary Information)
                  </label>
                  {layout.schedules.enabled && (
                    <div className="flex gap-2 px-2">
                      <input disabled={readOnly} className={`${inputCls} flex-1 text-xs`} value={layout.schedules.dividerTitle} onChange={(e) => setSchedules({ dividerTitle: e.target.value })} aria-label="Divider title" />
                      <select disabled={readOnly} className={`${inputCls} !w-auto text-xs`} value={layout.schedules.numbering} onChange={(e) => setSchedules({ numbering: e.target.value as 'numeric' | 'alpha' })} aria-label="Schedule numbering">
                        <option value="numeric">Schedule 1, 2…</option><option value="alpha">Schedule A, B…</option>
                      </select>
                    </div>
                  )}
                </div>
                <hr className="border-gray-100 dark:border-gray-700" />
                <StatementSettingsPanel statement={statement} onChange={setStatement} readOnly={readOnly} />
                {(statement.kind === 'balance_sheet' || statement.kind === 'income_statement') && (
                  <FsOutlinePanel statement={statement} onChange={setStatement} source={previewQ.data?.source} selectedId={selectedNode} onSelect={setSelectedNode} readOnly={readOnly} />
                )}
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  The layout and style belong to this client and are shared by all of its statement sets, every year.
                </p>
                {isAdmin && !isFinal && (
                  <button type="button" className={linkCls} disabled={dirtyLayout} title={dirtyLayout ? 'Save first' : undefined}
                    onClick={async () => {
                      const n = window.prompt('Name for the firm layout template', `${detail.layout.name} layout`);
                      if (!n?.trim()) return;
                      try {
                        await fsApi.saveLayoutAsTemplate(detail.layout.id, n.trim());
                        await qc.invalidateQueries({ queryKey: ['fs-library'] });
                        pushToast('Saved to the statement library', 'success');
                      } catch (e) { pushToast(fsErrorMessage(e, 'Save failed'), 'error'); }
                    }}>Save this layout as a firm template…</button>
                )}
              </>
            )}
            {tab === 'style' && (
              <StylePanel style={style} readOnly={readOnly} library={libraryQ.data} canManageLibrary={isAdmin}
                onChange={(s) => { setStyle(s); setDirtyLayout(true); }}
                onSaveAsPreset={async () => {
                  const n = window.prompt('Name for the firm style');
                  if (!n?.trim()) return;
                  try {
                    await fsApi.savePreset({ name: n.trim(), style });
                    await qc.invalidateQueries({ queryKey: ['fs-library'] });
                    pushToast('Style saved to the statement library', 'success');
                  } catch (e) { pushToast(fsErrorMessage(e, 'Save failed'), 'error'); }
                }} />
            )}
            {tab === 'front' && (
              <FrontMatterPanel value={frontMatter} library={libraryQ.data} readOnly={readOnly} onChange={(v) => { setFrontMatter(v); setDirtyReport(true); }} />
            )}
            {tab === 'classify' && (
              <div className="space-y-5">
                <Section title="Cash flows">
                  <CashFlowPanel data={cashFlowQ.data} readOnly={isReviewer}
                    onSet={(o) => saveClassification(() => fsApi.saveCashFlow(clientId!, [o]))} />
                </Section>
                <Section title="Equity">
                  <EquityRolesPanel accounts={equityQ.data?.accounts} readOnly={isReviewer}
                    onSet={(r) => saveClassification(() => fsApi.saveEquityRoles(clientId!, [r]))} />
                </Section>
              </div>
            )}
            {tab === 'checks' && (
              <ChecksPanel checks={checks} onFocus={(c) => {
                if (c.statementId && layout.statements.some((s) => s.id === c.statementId)) setStmtId(c.statementId);
                if (c.nodeId) setSelectedNode(c.nodeId);
                if (c.statementId || c.nodeId) setTab('statements');
              }} />
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm">
            <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-600 p-0.5">
              <button type="button" className={seg(view === 'live')} onClick={() => setView('live')}>Live</button>
              <button type="button" className={seg(view === 'pdf')} onClick={() => { setView('pdf'); void loadPdf(); }}>Exact PDF</button>
            </div>
            {view === 'pdf' && <button type="button" className={linkCls} onClick={() => void loadPdf()}>Refresh</button>}
            {previewQ.isFetching && <span className="text-xs text-gray-400">Updating numbers…</span>}
            {errorCount > 0 && (
              <button type="button" className="ml-auto text-xs text-red-600" onClick={() => setTab('checks')}>{errorCount} issue{errorCount === 1 ? '' : 's'} to resolve</button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {view === 'pdf' ? <FsPdfProof {...pdf} /> : computed.error ? (
              <div className="p-6"><ErrorBox>{computed.error}</ErrorBox></div>
            ) : previewError ? (
              <div className="p-6"><ErrorBox>{previewError} <button className="underline" onClick={() => previewQ.refetch()}>Retry</button></ErrorBox></div>
            ) : html ? <FsLivePreview html={html} /> : <div className="flex justify-center py-16"><Spinner size="lg" /></div>}
          </div>
        </div>
      </div>

      {finalizeDlg && <FinalizeDialog checks={finalizeDlg.checks} busy={finalizeM.isPending} onCancel={() => setFinalizeDlg(null)} onConfirm={(reason) => doFinalize({ reason })} />}
      {versionsOpen && <VersionsDrawer detail={detail} canWrite={!isReviewer} onClose={() => setVersionsOpen(false)} />}
    </div>
  );
}

function StaleBadge({ reportId, versionNo }: { reportId: number; versionNo: number }) {
  const { data } = useQuery({ queryKey: ['fs-impact', reportId, versionNo], queryFn: () => fsApi.impact(reportId, versionNo) });
  const text = data
    ? (data.changed ? 'Balances changed — these numbers would differ now' : 'Balances changed — these statements are unaffected')
    : 'Balances changed since finalizing';
  return <Badge tone={data && !data.changed ? 'gray' : 'amber'}>{text}</Badge>;
}

function FinalizeDialog({ checks, busy, onCancel, onConfirm }: { checks: FsCheck[]; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="These statements have issues" footer={(
      <>
        <Btn variant="secondary" onClick={onCancel}>Go back and fix</Btn>
        <Btn variant="danger" disabled={reason.trim().length < 5} busy={busy} onClick={() => onConfirm(reason.trim())}>Finalize anyway</Btn>
      </>
    )}>
      <ul className="list-disc pl-5 space-y-1 text-red-700 dark:text-red-400">{checks.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
      <p className="text-gray-600 dark:text-gray-300">You can fix them first, or finalize anyway with a reason. The reason is recorded in the audit log and on the version.</p>
      <textarea className={inputCls} rows={3} placeholder="Reason for finalizing with these issues" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

function VersionsDrawer({ detail, canWrite, onClose }: { detail: FsReportDetail; canWrite: boolean; onClose: () => void }) {
  const reportId = detail.report.id;
  const [busy, setBusy] = useState<string | null>(null);
  const download = async (v: FsVersion, f: 'pdf' | 'docx' | 'xlsx') => {
    setBusy(`${v.versionNo}:${f}`);
    try { await downloadFsExport(reportId, f, v.versionNo); } catch (e) { pushToast(fsErrorMessage(e, 'Download failed'), 'error'); } finally { setBusy(null); }
  };
  const saveToFolder = async (v: FsVersion) => {
    setBusy(`${v.versionNo}:folder`);
    try {
      const r = await fsApi.saveToFolder(reportId, v.versionNo);
      pushToast(`Saved to the client's documents as ${r.filename}`, 'success');
    } catch (e) {
      pushToast(e instanceof FsApiError && e.code === 'CLIENT_NOT_LINKED'
        ? 'This client has no document folder linked yet. Link one under Document Storage, then try again.'
        : fsErrorMessage(e, 'Could not save to the client folder'), 'error');
    } finally { setBusy(null); }
  };
  const chip = 'rounded border border-gray-200 dark:border-gray-600 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white dark:bg-gray-800 shadow-xl p-5 overflow-y-auto" role="dialog" aria-label="Versions" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Versions</h2>
          <button className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={onClose}>Close</button>
        </div>
        {!detail.versions.length && <p className="text-sm text-gray-500 dark:text-gray-400">Nothing finalized yet. Finalize to freeze a version you can download and file.</p>}
        <ul className="space-y-3">
          {detail.versions.map((v) => (
            <li key={v.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">Version {v.versionNo}</span>
                <Badge tone={v.status === 'final' ? 'green' : 'gray'}>{v.status === 'final' ? 'Current' : 'Superseded'}</Badge>
                {v.stale && <Badge tone="amber">Balances changed</Badge>}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Finalized {v.finalizedAt ? new Date(v.finalizedAt).toLocaleDateString() : ''}{v.finalizedByName ? ` by ${v.finalizedByName}` : ''}
                {v.pageCount ? ` · ${v.pageCount} pages` : ''}
              </div>
              {v.validationOverride && <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">Finalized with issues: {v.overrideReason ?? ''}</div>}
              {(!v.hasFile || v.regenerated) && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {v.regenerated ? 'This PDF was produced again from the frozen version; the original file was not kept.' : 'The PDF will be produced again from the frozen version when downloaded (it was not carried in the backup).'}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {(['pdf', 'docx', 'xlsx'] as const).map((f) => (
                  <button key={f} className={chip} disabled={busy !== null} onClick={() => download(v, f)}>{busy === `${v.versionNo}:${f}` ? '…' : f.toUpperCase()}</button>
                ))}
                {canWrite && <button className={chip} disabled={busy !== null} onClick={() => saveToFolder(v)}>{busy === `${v.versionNo}:folder` ? 'Saving…' : 'Save to client folder'}</button>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
