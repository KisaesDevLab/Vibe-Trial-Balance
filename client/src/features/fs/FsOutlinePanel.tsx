// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Outline editor for one balance sheet / income statement: a drag-and-drop
// tree of sections, lead sheet lines, pulled-out account lines, subtotals,
// text, blank lines and page breaks, with an inspector for the selected
// line (captions, summary vs detail vs schedule, rules, style, rounding
// plug) and a schedule editor (reorder, combine, split, pull out).
//
// Drag-and-drop is the native HTML5 API — no library. Every edit goes
// through the pure functions in fsTreeOps.ts, which is where the rules live
// (and are tested): this file only decides which one to call.

import { useMemo, useState, type DragEvent } from 'react';
import type {
  FsLeadsheetDisplay, FsNode, FsNodeRole, FsPolarity, FsRule, FsScheduleLine, FsSourceData, FsStatementConfig,
} from '../../lib/fsEngine';
import {
  allNodes, combineLines, deleteNodeFromStatement, effectiveScheduleLines, findNode, insertNode, moveLine, moveNode, newNodeId,
  splitLine, updateNode, type DropPosition,
} from './fsTreeOps';
import { Field, inputCls, linkCls } from './ui';

interface Props {
  statement: FsStatementConfig;
  onChange: (st: FsStatementConfig) => void;
  source: FsSourceData | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  readOnly: boolean;
}

const TYPE_LABEL: Record<FsNode['type'], string> = {
  section: 'Section', leadsheet: 'Lead sheet', account: 'Account line', total: 'Total', text: 'Text', blank: 'Blank line', page_break: 'Page break',
};

const byNumber = (a: { number: string | null }, b: { number: string | null }) => (a.number ?? '').localeCompare(b.number ?? '', undefined, { numeric: true });

export function FsOutlinePanel({ statement, onChange, source, selectedId, onSelect, readOnly }: Props) {
  const [drag, setDrag] = useState<{ id: string; over: string | null; pos: DropPosition } | null>(null);
  const flat = allNodes(statement.body);
  const groupingById = useMemo(() => new Map((source?.groupings ?? []).map((g) => [g.id, g])), [source]);
  const groupingByCode = useMemo(() => new Map((source?.groupings ?? []).filter((g) => g.code).map((g) => [g.code!, g])), [source]);
  const label = (n: FsNode): string => {
    if (n.type === 'section') return n.caption || '(section)';
    if (n.type === 'leadsheet') {
      const g = (n.ref.groupingId ? groupingById.get(n.ref.groupingId) : undefined) ?? (n.ref.leadsheetCode ? groupingByCode.get(n.ref.leadsheetCode) : undefined);
      return n.caption || g?.name || n.ref.leadsheetCode || 'Lead sheet';
    }
    if (n.type === 'account' || n.type === 'total') return n.caption;
    if (n.type === 'text') return n.text || '(text)';
    return TYPE_LABEL[n.type];
  };

  const setBody = (body: FsNode[]) => onChange({ ...statement, body });
  const add = (node: FsNode) => {
    const sel = selectedId ? findNode(statement.body, selectedId) : null;
    const pos: DropPosition = sel?.type === 'section' ? 'inside' : 'after';
    setBody(insertNode(statement.body, node, sel ? sel.id : null, sel ? pos : 'after'));
    onSelect(node.id);
  };
  const firstGrouping = source?.groupings[0];
  const firstAccount = source ? [...source.accounts].filter((a) => !a.isVirtual).sort(byNumber)[0] : undefined;

  const onDragOver = (e: DragEvent, n: FsNode) => {
    if (!drag || readOnly) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    // The middle band of a section row drops INSIDE it; the edges reorder.
    const pos: DropPosition = n.type === 'section' && y > 0.3 && y < 0.7 ? 'inside' : y < 0.5 ? 'before' : 'after';
    if (drag.over !== n.id || drag.pos !== pos) setDrag({ ...drag, over: n.id, pos });
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (drag?.over && drag.over !== drag.id) setBody(moveNode(statement.body, drag.id, drag.over, drag.pos));
    setDrag(null);
  };

  const selected = selectedId ? findNode(statement.body, selectedId) : null;

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="flex flex-wrap gap-1">
          <AddBtn label="Section" onClick={() => add({ type: 'section', id: newNodeId('sec'), caption: 'New section', showHeading: true, showTotal: true, children: [] })} />
          <AddBtn label="Lead sheet" disabled={!firstGrouping} title={firstGrouping ? undefined : 'This client has no lead sheets yet'}
            onClick={() => firstGrouping && add({ type: 'leadsheet', id: newNodeId('ls'), ref: { groupingId: firstGrouping.id, leadsheetCode: firstGrouping.code ?? undefined }, display: 'single_line' })} />
          <AddBtn label="Account line" disabled={!firstAccount}
            onClick={() => firstAccount && add({ type: 'account', id: newNodeId('acct'), caption: firstAccount.name, refs: [{ accountId: firstAccount.id }] })} />
          <AddBtn label="Total" onClick={() => add({ type: 'total', id: newNodeId('tot'), caption: 'Total', terms: [], ruleAbove: 'single' })} />
          <AddBtn label="Text" onClick={() => add({ type: 'text', id: newNodeId('txt'), text: 'Text' })} />
          <AddBtn label="Blank" onClick={() => add({ type: 'blank', id: newNodeId('blank') })} />
          <AddBtn label="Page break" onClick={() => add({ type: 'page_break', id: newNodeId('pb') })} />
        </div>
      )}

      <ul
        className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-50 dark:divide-gray-700/60 text-sm max-h-[45vh] overflow-y-auto"
        onDragLeave={() => drag && setDrag({ ...drag, over: null })}
      >
        {flat.map(({ node, depth }) => {
          const isSel = node.id === selectedId;
          const over = drag?.over === node.id;
          return (
            <li
              key={node.id}
              draggable={!readOnly}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: node.id, over: null, pos: 'after' }); }}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => onDragOver(e, node)}
              onDrop={onDrop}
              onClick={() => onSelect(node.id)}
              className={[
                'flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none',
                isSel ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                over && drag?.pos === 'before' ? 'border-t-2 border-t-blue-500' : '',
                over && drag?.pos === 'after' ? 'border-b-2 border-b-blue-500' : '',
                over && drag?.pos === 'inside' ? 'ring-2 ring-inset ring-blue-400' : '',
              ].join(' ')}
              style={{ paddingLeft: 8 + depth * 16 }}
            >
              {!readOnly && <span className="text-gray-300 dark:text-gray-600 shrink-0 cursor-grab" aria-hidden>⠿</span>}
              <span className={`truncate ${node.type === 'section' ? 'font-semibold text-gray-900 dark:text-white' : node.type === 'total' ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                {node.type === 'total' ? '= ' : ''}{label(node)}
              </span>
              <span className="ml-auto flex items-center gap-1 shrink-0">
                {node.type === 'leadsheet' && node.display !== 'single_line' && (
                  <span className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 text-[10px] uppercase tracking-wide text-gray-600 dark:text-gray-300">{node.display === 'detail' ? 'detail' : 'schedule'}</span>
                )}
                {(node.type === 'section' || node.type === 'total') && node.role && <span className="rounded bg-blue-50 dark:bg-blue-900/40 px-1.5 text-[10px] uppercase text-blue-700 dark:text-blue-300">check</span>}
                {node.type === 'page_break' && <span className="text-[10px] text-gray-400">— new page —</span>}
                {!readOnly && (
                  <button
                    type="button" aria-label={`Delete ${label(node)}`} title="Delete" className="px-1 text-gray-300 dark:text-gray-600 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); onChange(deleteNodeFromStatement(statement, node.id)); if (isSel) onSelect(null); }}
                  >✕</button>
                )}
              </span>
            </li>
          );
        })}
        {!flat.length && <li className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">No lines yet — add a section or a lead sheet.</li>}
      </ul>

      {selected && (
        <NodeInspector
          key={selected.id}
          node={selected}
          statement={statement}
          source={source}
          readOnly={readOnly}
          onPatch={(fn) => setBody(updateNode(statement.body, selected.id, fn))}
          onStatement={onChange}
          label={label}
        />
      )}
    </div>
  );
}

function AddBtn({ label, onClick, disabled, title }: { label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
      <span className="text-gray-400">+</span>{label}
    </button>
  );
}

type Tri = boolean | undefined;
function TriSelect({ value, onChange }: { value: Tri; onChange: (v: Tri) => void }) {
  return (
    <select className={inputCls} value={value === undefined ? '' : value ? '1' : '0'} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === '1')}>
      <option value="">Default</option>
      <option value="1">Yes</option>
      <option value="0">No</option>
    </select>
  );
}

const check = 'flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300';

function NodeInspector({ node, statement, source, readOnly, onPatch, onStatement, label }: {
  node: FsNode;
  statement: FsStatementConfig;
  source: FsSourceData | undefined;
  readOnly: boolean;
  onPatch: (fn: (n: FsNode) => FsNode) => void;
  onStatement: (st: FsStatementConfig) => void;
  label: (n: FsNode) => string;
}) {
  const patch = <T extends FsNode>(p: Partial<T>) => onPatch((n) => ({ ...n, ...p }) as FsNode);
  const style = node.style ?? {};
  const setStyle = (p: Partial<NonNullable<FsNode['style']>>) => {
    const next = { ...style, ...p };
    for (const k of Object.keys(next) as Array<keyof typeof next>) if (next[k] === undefined) delete next[k];
    patch({ style: Object.keys(next).length ? next : undefined });
  };
  const isAnchor = (node.type === 'section' || node.type === 'total') && (!!node.role || !!node.anchor);
  const leafOptions = allNodes(statement.body).map((x) => x.node).filter((n) => n.type === 'leadsheet' || n.type === 'account');
  const termOptions = allNodes(statement.body).map((x) => x.node).filter((n) => n.id !== node.id && (n.type === 'section' || n.type === 'leadsheet' || n.type === 'account' || n.type === 'total'));

  return (
    <fieldset disabled={readOnly} className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 space-y-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{TYPE_LABEL[node.type]}</div>

      {node.type === 'section' && (
        <>
          <Field label="Heading"><input className={inputCls} value={node.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <label className={check}><input type="checkbox" checked={node.showHeading !== false} onChange={(e) => patch({ showHeading: e.target.checked })} />Show heading</label>
            <label className={check}><input type="checkbox" checked={node.showTotal !== false} onChange={(e) => patch({ showTotal: e.target.checked })} />Show total</label>
          </div>
          {node.showTotal !== false && <Field label="Total caption"><input className={inputCls} placeholder={`Total ${node.caption.toLowerCase()}`} value={node.totalCaption ?? ''} onChange={(e) => patch({ totalCaption: e.target.value || undefined })} /></Field>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amounts shown as"><PolaritySelect value={node.polarity} onChange={(polarity) => patch({ polarity })} /></Field>
            <Field label="Checked as"><RoleSelect value={node.role} onChange={(role) => patch({ role })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rule above total"><RuleSelect single value={node.totalRuleAbove ?? 'single'} onChange={(v) => patch({ totalRuleAbove: v as 'none' | 'single' })} /></Field>
            <Field label="Rule below total"><RuleSelect value={node.totalRuleBelow ?? 'none'} onChange={(v) => patch({ totalRuleBelow: v })} /></Field>
          </div>
        </>
      )}

      {node.type === 'leadsheet' && (
        <>
          <Field label="Lead sheet">
            <select className={inputCls} value={node.ref.groupingId ?? ''} onChange={(e) => {
              const g = source?.groupings.find((x) => x.id === e.target.value);
              // The accounts belong to the lead sheet, so a customized schedule does not carry over.
              patch({ ref: { groupingId: e.target.value, leadsheetCode: g?.code ?? undefined }, scheduleLines: undefined });
            }}>
              {!node.ref.groupingId && <option value="">{node.ref.leadsheetCode ? `Code ${node.ref.leadsheetCode} (not linked)` : 'Choose…'}</option>}
              {(source?.groupings ?? []).map((g) => <option key={g.id} value={g.id}>{g.code ? `${g.code} — ` : ''}{g.name}</option>)}
            </select>
          </Field>
          <Field label="Caption"><input className={inputCls} placeholder="Lead sheet name" value={node.caption ?? ''} onChange={(e) => patch({ caption: e.target.value || undefined })} /></Field>
          <Field label="Show as">
            <select className={inputCls} value={node.display} onChange={(e) => patch({ display: e.target.value as FsLeadsheetDisplay })}>
              <option value="single_line">One summary line</option>
              <option value="detail">Detail — every account on the statement</option>
              <option value="summary_with_schedule">Summary line + supporting schedule</option>
            </select>
          </Field>
          {node.display === 'summary_with_schedule' && (
            <Field label="Schedule title"><input className={inputCls} placeholder={`Schedule of ${label(node)}`} value={node.scheduleTitle ?? ''} onChange={(e) => patch({ scheduleTitle: e.target.value || undefined })} /></Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amounts shown as"><PolaritySelect value={node.polarity} onChange={(polarity) => patch({ polarity })} /></Field>
            <label className={`${check} items-end pb-1.5`}><input type="checkbox" checked={!!node.revenueBase} onChange={(e) => patch({ revenueBase: e.target.checked || undefined })} />Base for % of revenue</label>
          </div>
          {node.display !== 'single_line' && source && (
            <ScheduleEditor node={node} source={source} readOnly={readOnly}
              onLines={(scheduleLines) => patch({ scheduleLines })}
              onPullOut={(accountId, caption) => {
                const acct: FsNode = { type: 'account', id: newNodeId('acct'), refs: [{ accountId }], caption, polarity: node.polarity };
                onStatement({ ...statement, body: insertNode(statement.body, acct, node.id, 'after') });
              }}
            />
          )}
        </>
      )}

      {node.type === 'account' && (
        <>
          <Field label="Caption"><input className={inputCls} value={node.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
          <Field label="Accounts on this line" hint="An account shown here leaves its lead sheet line, so nothing is counted twice.">
            <AccountRefsEditor refs={node.refs} source={source} onChange={(refs) => patch({ refs })} />
          </Field>
          <Field label="Amounts shown as"><PolaritySelect value={node.polarity} onChange={(polarity) => patch({ polarity })} /></Field>
        </>
      )}

      {node.type === 'total' && (
        <>
          <Field label="Caption"><input className={inputCls} value={node.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
          <Field label="Adds up">
            <div className="space-y-1">
              {node.terms.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select className={`${inputCls} !w-14`} aria-label="Sign" value={t.sign} onChange={(e) => patch({ terms: node.terms.map((x, j) => (j === i ? { ...x, sign: Number(e.target.value) as 1 | -1 } : x)) })}>
                    <option value={1}>+</option><option value={-1}>−</option>
                  </select>
                  <select className={inputCls} aria-label="Line" value={t.nodeId} onChange={(e) => patch({ terms: node.terms.map((x, j) => (j === i ? { ...x, nodeId: e.target.value } : x)) })}>
                    {!termOptions.some((o) => o.id === t.nodeId) && <option value={t.nodeId}>(missing line)</option>}
                    {termOptions.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
                  </select>
                  <button type="button" className="px-1 text-gray-400 hover:text-red-600" aria-label="Remove" onClick={() => patch({ terms: node.terms.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              {termOptions[0] && (
                <button type="button" className={linkCls} onClick={() => patch({ terms: [...node.terms, { nodeId: termOptions[0]!.id, sign: 1 }] })}>+ Add line</button>
              )}
            </div>
          </Field>
          <Field label="Checked as"><RoleSelect value={node.role} onChange={(role) => patch({ role })} /></Field>
        </>
      )}

      {node.type === 'text' && (
        <Field label="Text"><textarea className={`${inputCls} min-h-[60px]`} value={node.text} onChange={(e) => patch({ text: e.target.value })} /></Field>
      )}

      {node.type !== 'blank' && node.type !== 'page_break' && (
        <details className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
          <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">Line format</summary>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Field label="Bold"><TriSelect value={style.bold} onChange={(bold) => setStyle({ bold })} /></Field>
            <Field label="Italic"><TriSelect value={style.italic} onChange={(italic) => setStyle({ italic })} /></Field>
            <Field label="All caps"><TriSelect value={style.caps} onChange={(caps) => setStyle({ caps })} /></Field>
            <Field label="Extra indent"><input type="number" min={-4} max={6} className={inputCls} value={style.indent ?? 0} onChange={(e) => setStyle({ indent: Number(e.target.value) || undefined })} /></Field>
            <Field label="Size +/− pt"><input type="number" min={-4} max={8} step={0.5} className={inputCls} value={style.sizeDelta ?? 0} onChange={(e) => setStyle({ sizeDelta: Number(e.target.value) || undefined })} /></Field>
            <Field label="Hide when zero"><TriSelect value={node.hideWhenZero} onChange={(hideWhenZero) => patch({ hideWhenZero })} /></Field>
            {node.type !== 'section' && (
              <>
                <Field label="Rule above"><RuleSelect single value={node.ruleAbove ?? 'none'} onChange={(v) => patch({ ruleAbove: v === 'none' ? undefined : (v as 'single') })} /></Field>
                <Field label="Rule below"><RuleSelect value={node.ruleBelow ?? 'none'} onChange={(v) => patch({ ruleBelow: v === 'none' ? undefined : v })} /></Field>
              </>
            )}
            <label className={`${check} items-end pb-1.5`}><input type="checkbox" checked={!!node.breakBefore} onChange={(e) => patch({ breakBefore: e.target.checked || undefined })} />New page before</label>
          </div>
        </details>
      )}

      {isAnchor && (
        <Field label="Rounding goes to" hint="Whole-dollar rounding is placed on one line so this total still foots.">
          <select className={inputCls} value={statement.plugs?.[node.id] ?? ''} onChange={(e) => {
            const plugs = { ...(statement.plugs ?? {}) };
            if (e.target.value) plugs[node.id] = e.target.value; else delete plugs[node.id];
            onStatement({ ...statement, plugs });
          }}>
            <option value="">Largest line (never cash)</option>
            {leafOptions.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
          </select>
        </Field>
      )}
    </fieldset>
  );
}

function PolaritySelect({ value, onChange }: { value: FsPolarity | undefined; onChange: (v: FsPolarity | undefined) => void }) {
  return (
    <select className={inputCls} value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as FsPolarity | undefined)}>
      <option value="">Automatic</option>
      <option value="debit">Debits positive (assets, expenses)</option>
      <option value="credit">Credits positive (liabilities, equity, revenue)</option>
    </select>
  );
}

function RoleSelect({ value, onChange }: { value: FsNodeRole | undefined; onChange: (v: FsNodeRole | undefined) => void }) {
  return (
    <select className={inputCls} value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as FsNodeRole | undefined)}>
      <option value="">—</option>
      <option value="total_assets">Total assets</option>
      <option value="total_liabilities_equity">Total liabilities &amp; equity</option>
      <option value="net_income">Net income</option>
    </select>
  );
}

function RuleSelect({ value, onChange, single }: { value: FsRule; onChange: (v: FsRule) => void; single?: boolean }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as FsRule)}>
      <option value="none">None</option>
      <option value="single">Single</option>
      {!single && <option value="double">Double</option>}
    </select>
  );
}

function AccountRefsEditor({ refs, source, onChange }: { refs: Array<{ accountId: string }>; source: FsSourceData | undefined; onChange: (r: Array<{ accountId: string }>) => void }) {
  const accounts = [...(source?.accounts ?? [])].filter((a) => !a.isVirtual).sort(byNumber);
  const known = new Set(accounts.map((a) => a.id));
  const unused = accounts.find((a) => !refs.some((r) => r.accountId === a.id));
  return (
    <div className="space-y-1">
      {refs.map((r, i) => (
        <div key={i} className="flex gap-1">
          <select className={inputCls} aria-label="Account" value={r.accountId} onChange={(e) => onChange(refs.map((x, j) => (j === i ? { accountId: e.target.value } : x)))}>
            {/* An account with no balance in this period is not in the source, but the layout may still name it. */}
            {!known.has(r.accountId) && <option value={r.accountId}>(no balance this period)</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.number ? `${a.number} ` : ''}{a.name}</option>)}
          </select>
          {refs.length > 1 && <button type="button" className="px-1 text-gray-400 hover:text-red-600" aria-label="Remove account" onClick={() => onChange(refs.filter((_, j) => j !== i))}>✕</button>}
        </div>
      ))}
      {unused && <button type="button" className={linkCls} onClick={() => onChange([...refs, { accountId: unused.id }])}>+ Add account</button>}
    </div>
  );
}

function ScheduleEditor({ node, source, readOnly, onLines, onPullOut }: {
  node: Extract<FsNode, { type: 'leadsheet' }>;
  source: FsSourceData;
  readOnly: boolean;
  onLines: (lines: FsScheduleLine[] | undefined) => void;
  onPullOut: (accountId: string, caption: string) => void;
}) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const g = (node.ref.groupingId ? source.groupings.find((x) => x.id === node.ref.groupingId) : undefined)
    ?? (node.ref.leadsheetCode ? source.groupings.find((x) => x.code === node.ref.leadsheetCode) : undefined) ?? null;
  const acctById = new Map(source.accounts.map((a) => [a.id, a]));
  const order = (a: string, b: string) => (acctById.get(a)?.number ?? '').localeCompare(acctById.get(b)?.number ?? '', undefined, { numeric: true });
  // Signed cents for this period (debit positive) — shown here in whole dollars as a guide only.
  const cy = source.snapshots[source.periodEnd]?.balances ?? {};
  const ids = (g?.accountIds ?? []).filter((id) => acctById.has(id));
  const lines = effectiveScheduleLines(node.scheduleLines, ids, order);
  const amount = (l: FsScheduleLine) => l.accountRefs.reduce((s, r) => s + (cy[r.accountId] ?? 0), 0) / 100;
  const capOf = (l: FsScheduleLine) => l.caption || (l.accountRefs.length === 1 ? acctById.get(l.accountRefs[0]!.accountId)?.name ?? 'Account' : 'Combined');
  const commit = (next: FsScheduleLine[]) => { onLines(next.length ? next : undefined); setSel(new Set()); };
  if (!g) return <p className="text-xs text-amber-700 dark:text-amber-400">Link this line to a lead sheet to edit its accounts.</p>;

  const small = 'inline-flex items-center gap-1 rounded border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 text-xs text-gray-700 dark:text-gray-200 disabled:opacity-40';
  const icon = 'px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200';
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Accounts ({node.display === 'detail' ? 'shown on the statement' : 'on the schedule'})</span>
        {!readOnly && (
          <div className="flex gap-1">
            <button type="button" disabled={sel.size < 2} className={small}
              onClick={() => {
                const caption = window.prompt('Caption for the combined line', 'Combined');
                if (caption) commit(combineLines(lines, [...sel], caption));
              }}>Combine</button>
            {node.scheduleLines?.length ? (
              <button type="button" className={small} onClick={() => commit([])} title="Back to one line per account, by number">Reset</button>
            ) : null}
          </div>
        )}
      </div>
      <ul className="divide-y divide-gray-50 dark:divide-gray-700/60 max-h-64 overflow-y-auto">
        {lines.map((l, i) => (
          <li key={l.id} className="flex items-center gap-1.5 px-2 py-1 text-xs">
            {!readOnly && <input type="checkbox" checked={sel.has(i)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(i); else s.delete(i); setSel(s); }} aria-label={`Select ${capOf(l)}`} />}
            <input
              className="flex-1 min-w-0 rounded border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-gray-300 bg-transparent text-gray-800 dark:text-gray-100 text-xs py-0.5 px-1"
              value={capOf(l)} disabled={readOnly} aria-label="Line caption"
              onChange={(e) => commit(lines.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
            />
            {l.accountRefs.length > 1 && <span className="text-gray-400">{l.accountRefs.length} accts</span>}
            <span className="w-20 text-right tabular-nums text-gray-600 dark:text-gray-300">{amount(l).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            {!readOnly && (
              <span className="flex">
                <button type="button" className={icon} aria-label="Move up" title="Move up" onClick={() => commit(moveLine(lines, i, -1))}>↑</button>
                <button type="button" className={icon} aria-label="Move down" title="Move down" onClick={() => commit(moveLine(lines, i, 1))}>↓</button>
                {l.accountRefs.length > 1 && <button type="button" className={icon} aria-label="Split" title="Split into one line per account" onClick={() => commit(splitLine(lines, i))}>⇅</button>}
                {l.accountRefs.length === 1 && (
                  <button type="button" className={`${icon} hover:text-blue-700`} aria-label="Pull out" title="Show this account as its own line on the statement"
                    onClick={() => onPullOut(l.accountRefs[0]!.accountId, capOf(l))}>↗</button>
                )}
              </span>
            )}
          </li>
        ))}
        {!lines.length && <li className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">No accounts with a balance on this lead sheet.</li>}
      </ul>
    </div>
  );
}
