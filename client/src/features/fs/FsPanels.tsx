// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// The statement editor's left-hand panels other than the outline: per-
// statement settings, style, front matter (cover / contents / accountant's
// report), cash-flow and equity classification, and the checks list.

import { Link } from 'react-router-dom';
import {
  FS_FONTS, FS_PAGE_NUMBER_FORMATS, FS_STYLE_ELEMENTS,
  type FsCashFlowClass, type FsCheck, type FsElementStyle, type FsEquityRole, type FsFrontMatter, type FsPageSetup,
  type FsStatementConfig, type FsStyle, type FsStyleElement,
} from '../../lib/fsEngine';
import type { FsCashFlowData, FsEquityRoleAccount, FsLibrary } from '../../api/fs';
import { RichTextEditor } from '../../components/RichTextEditor';
import { Field, Section, inputCls, linkCls } from './ui';

const check = 'flex items-center gap-2 text-gray-700 dark:text-gray-300';

// ─── Statement settings ────────────────────────────────────────────

export function StatementSettingsPanel({ statement, onChange, readOnly }: { statement: FsStatementConfig; onChange: (s: FsStatementConfig) => void; readOnly: boolean }) {
  const ps = statement.pageSetup ?? {};
  const setPs = (p: Partial<FsPageSetup>) => {
    const next = { ...ps, ...p };
    for (const k of Object.keys(next) as Array<keyof FsPageSetup>) if (next[k] === undefined) delete next[k];
    onChange({ ...statement, pageSetup: Object.keys(next).length ? next : undefined });
  };
  return (
    <fieldset disabled={readOnly} className="space-y-3 text-sm">
      <label className={check}><input type="checkbox" checked={statement.enabled} onChange={(e) => onChange({ ...statement, enabled: e.target.checked })} />Include this statement</label>
      <Field label="Title" hint="Blank = the standard title for the basis and entity type">
        <input className={inputCls} value={statement.titleOverride ?? ''} onChange={(e) => onChange({ ...statement, titleOverride: e.target.value || undefined })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Orientation">
          <select className={inputCls} value={ps.orientation ?? ''} onChange={(e) => setPs({ orientation: (e.target.value || undefined) as FsPageSetup['orientation'] | undefined })}>
            <option value="">Document default</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option>
          </select>
        </Field>
        <Field label="Paper">
          <select className={inputCls} value={ps.paper ?? ''} onChange={(e) => setPs({ paper: (e.target.value || undefined) as FsPageSetup['paper'] | undefined })}>
            <option value="">Document default</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="a4">A4</option>
          </select>
        </Field>
      </div>

      {statement.kind === 'equity' && (
        <>
          <Field label="Columns">
            <select className={inputCls} value={statement.equity?.columns ?? 'auto'} onChange={(e) => onChange({ ...statement, equity: { ...statement.equity, columns: e.target.value as 'auto' | 'single' | 'by_account' } })}>
              <option value="auto">Automatic (by account for corporations)</option>
              <option value="by_account">One column per equity account</option>
              <option value="single">Single column</option>
            </select>
          </Field>
          <CaptionGrid
            keys={[['beginning', 'Beginning balance'], ['netIncome', 'Net income'], ['contributions', 'Contributions'], ['distributions', 'Distributions'], ['other', 'Other changes'], ['ending', 'Ending balance'], ['total', 'Total column']]}
            values={statement.equity?.captions ?? {}}
            onChange={(captions) => onChange({ ...statement, equity: { ...statement.equity, captions } })}
          />
        </>
      )}

      {statement.kind === 'cash_flows' && (
        <>
          <label className={check}><input type="checkbox" checked={statement.cashFlow?.detailByAccount === true} onChange={(e) => onChange({ ...statement, cashFlow: { ...statement.cashFlow, detailByAccount: e.target.checked } })} />One line per account (instead of per lead sheet)</label>
          <CaptionGrid
            keys={[['operatingHeading', 'Operating heading'], ['netIncome', 'Net income'], ['netOperating', 'Net operating'], ['investingHeading', 'Investing heading'], ['netInvesting', 'Net investing'], ['financingHeading', 'Financing heading'], ['netFinancing', 'Net financing'], ['netChange', 'Net change in cash'], ['beginningCash', 'Beginning cash'], ['endingCash', 'Ending cash']]}
            values={statement.cashFlow?.captions ?? {}}
            onChange={(captions) => onChange({ ...statement, cashFlow: { ...statement.cashFlow, captions } })}
          />
        </>
      )}
    </fieldset>
  );
}

function CaptionGrid<K extends string>({ keys, values, onChange }: { keys: Array<[K, string]>; values: Partial<Record<K, string>>; onChange: (v: Partial<Record<K, string>>) => void }) {
  return (
    <details className="rounded border border-gray-200 dark:border-gray-700 p-2">
      <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">Captions</summary>
      <div className="mt-2 space-y-1.5">
        {keys.map(([k, label]) => (
          <Field key={k} label={label}>
            <input className={inputCls} placeholder="Default" value={values[k] ?? ''} onChange={(e) => {
              const next = { ...values };
              if (e.target.value) next[k] = e.target.value; else delete next[k];
              onChange(next);
            }} />
          </Field>
        ))}
      </div>
    </details>
  );
}

// ─── Style ─────────────────────────────────────────────────────────

const ELEMENT_LABEL: Record<FsStyleElement, string> = {
  companyName: 'Company name', statementTitle: 'Statement title', dateLine: 'Date line', columnHeader: 'Column headings',
  sectionHeading: 'Section headings', detail: 'Detail lines', subtotal: 'Subtotals', total: 'Totals', text: 'Text / notes', footer: 'Footer',
};
const PAGE_NUMBER_SAMPLE = { n: '3', dash_n: '- 3 -', page_n: 'Page 3', page_n_of_total: 'Page 3 of 9', none: 'None' } as const;

export function StylePanel({ style, onChange, readOnly, library, onSaveAsPreset, canManageLibrary }: {
  style: FsStyle;
  onChange: (s: FsStyle) => void;
  readOnly: boolean;
  /** Omit to hide the "apply a firm style" row (the library page edits a preset itself). */
  library?: FsLibrary;
  onSaveAsPreset?: () => void;
  canManageLibrary?: boolean;
}) {
  const setEl = (k: FsStyleElement, p: Partial<FsElementStyle>) => onChange({ ...style, elements: { ...style.elements, [k]: { ...style.elements[k], ...p } } });
  const m = style.page.margins;
  const num = 'w-14 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-1 text-xs py-0.5';
  return (
    <fieldset disabled={readOnly} className="space-y-5 text-sm">
      {library && (
        <Section title="Preset">
          <div className="flex gap-2">
            <select className={inputCls} value="" aria-label="Apply a firm style" onChange={(e) => {
              const p = library.presets.find((x) => String(x.id) === e.target.value);
              if (p) onChange(p.style);
            }}>
              <option value="">Apply a firm style…</option>
              {library.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {canManageLibrary && onSaveAsPreset && (
              <button type="button" className="shrink-0 rounded-md border border-gray-300 dark:border-gray-600 px-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={onSaveAsPreset}>Save as firm style</button>
            )}
          </div>
        </Section>
      )}

      <Section title="Font">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Typeface">
            <select className={inputCls} value={style.fontKey} onChange={(e) => onChange({ ...style, fontKey: e.target.value as FsStyle['fontKey'] })}>
              {FS_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Base size (pt)"><input type="number" step={0.5} min={7} max={16} className={inputCls} value={style.baseSizePt} onChange={(e) => onChange({ ...style, baseSizePt: Number(e.target.value) })} /></Field>
          <Field label="Line spacing"><input type="number" step={0.05} min={1} max={2.2} className={inputCls} value={style.lineHeight} onChange={(e) => onChange({ ...style, lineHeight: Number(e.target.value) })} /></Field>
          <Field label="Indent step (pt)"><input type="number" min={4} max={36} className={inputCls} value={style.indentPt} onChange={(e) => onChange({ ...style, indentPt: Number(e.target.value) })} /></Field>
        </div>
        <table className="w-full text-xs mt-2">
          <thead><tr className="text-gray-500 dark:text-gray-400"><th className="text-left font-medium">Element</th><th className="font-medium">Size</th><th className="font-medium">B</th><th className="font-medium">I</th><th className="font-medium">CAPS</th></tr></thead>
          <tbody>
            {FS_STYLE_ELEMENTS.map((k) => (
              <tr key={k}>
                <td className="py-0.5 text-gray-700 dark:text-gray-300">{ELEMENT_LABEL[k]}</td>
                <td className="py-0.5 w-16"><input type="number" step={0.5} min={6} max={28} className={num} value={style.elements[k].sizePt} onChange={(e) => setEl(k, { sizePt: Number(e.target.value) })} aria-label={`${ELEMENT_LABEL[k]} size`} /></td>
                <td className="text-center"><input type="checkbox" checked={style.elements[k].bold} onChange={(e) => setEl(k, { bold: e.target.checked })} aria-label={`${ELEMENT_LABEL[k]} bold`} /></td>
                <td className="text-center"><input type="checkbox" checked={style.elements[k].italic} onChange={(e) => setEl(k, { italic: e.target.checked })} aria-label={`${ELEMENT_LABEL[k]} italic`} /></td>
                <td className="text-center"><input type="checkbox" checked={!!style.elements[k].caps} onChange={(e) => setEl(k, { caps: e.target.checked })} aria-label={`${ELEMENT_LABEL[k]} caps`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Field label="Title block">
          <select className={inputCls} value={style.titleBlock.align} onChange={(e) => onChange({ ...style, titleBlock: { align: e.target.value as 'left' | 'center' } })}>
            <option value="center">Centered</option><option value="left">Left</option>
          </select>
        </Field>
      </Section>

      <Section title="Numbers">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Rounding">
            <select className={inputCls} value={style.number.decimals} onChange={(e) => onChange({ ...style, number: { ...style.number, decimals: Number(e.target.value) as 0 | 2 } })}>
              <option value={0}>Whole dollars</option><option value={2}>Cents</option>
            </select>
          </Field>
          <Field label="Dollar signs">
            <select className={inputCls} value={style.number.dollarSigns} onChange={(e) => onChange({ ...style, number: { ...style.number, dollarSigns: e.target.value as 'first_and_totals' | 'none' } })}>
              <option value="first_and_totals">First line &amp; totals</option><option value="none">None</option>
            </select>
          </Field>
          <Field label="Negatives">
            <select className={inputCls} value={style.number.negative} onChange={(e) => onChange({ ...style, number: { ...style.number, negative: e.target.value as 'parens' | 'minus' } })}>
              <option value="parens">(1,234)</option><option value="minus">-1,234</option>
            </select>
          </Field>
          <Field label="Zero">
            <select className={inputCls} value={style.number.zero} onChange={(e) => onChange({ ...style, number: { ...style.number, zero: e.target.value as 'dash' | 'zero' } })}>
              <option value="dash">—</option><option value="zero">0</option>
            </select>
          </Field>
          <Field label="Amount column width (in)"><input type="number" step={0.05} min={0.6} max={2.5} className={inputCls} value={style.amountColumnWidthIn} onChange={(e) => onChange({ ...style, amountColumnWidthIn: Number(e.target.value) })} /></Field>
          <label className="flex items-end gap-1.5 text-xs pb-1.5 text-gray-700 dark:text-gray-300"><input type="checkbox" checked={style.number.hideZeroLines} onChange={(e) => onChange({ ...style, number: { ...style.number, hideZeroLines: e.target.checked } })} />Hide zero lines</label>
        </div>
      </Section>

      <Section title="Page">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Paper">
            <select className={inputCls} value={style.page.paper} onChange={(e) => onChange({ ...style, page: { ...style.page, paper: e.target.value as FsPageSetup['paper'] } })}>
              <option value="letter">Letter</option><option value="legal">Legal</option><option value="a4">A4</option>
            </select>
          </Field>
          <Field label="Orientation">
            <select className={inputCls} value={style.page.orientation} onChange={(e) => onChange({ ...style, page: { ...style.page, orientation: e.target.value as FsPageSetup['orientation'] } })}>
              <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
            </select>
          </Field>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <Field key={side} label={`${side[0]!.toUpperCase()}${side.slice(1)} margin (in)`}>
              <input type="number" step={0.05} min={0.25} max={3} className={inputCls} value={m[side]} onChange={(e) => onChange({ ...style, page: { ...style.page, margins: { ...m, [side]: Number(e.target.value) } } })} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Footer">
        <Field label="Footer text"><input className={inputCls} value={style.footer.text} onChange={(e) => onChange({ ...style, footer: { ...style.footer, text: e.target.value } })} /></Field>
        <div className="flex gap-4 text-xs text-gray-700 dark:text-gray-300">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={style.footer.onStatements} onChange={(e) => onChange({ ...style, footer: { ...style.footer, onStatements: e.target.checked } })} />On statements</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={style.footer.onSchedules} onChange={(e) => onChange({ ...style, footer: { ...style.footer, onSchedules: e.target.checked } })} />On schedules</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Page numbers">
            <select className={inputCls} value={style.footer.pageNumber.format} onChange={(e) => onChange({ ...style, footer: { ...style.footer, pageNumber: { ...style.footer.pageNumber, format: e.target.value as FsStyle['footer']['pageNumber']['format'] } } })}>
              {FS_PAGE_NUMBER_FORMATS.map((f) => <option key={f} value={f}>{PAGE_NUMBER_SAMPLE[f]}</option>)}
            </select>
          </Field>
          <Field label="Position">
            <select className={inputCls} value={style.footer.pageNumber.position} onChange={(e) => onChange({ ...style, footer: { ...style.footer, pageNumber: { ...style.footer.pageNumber, position: e.target.value as 'bottom_center' | 'bottom_right' } } })}>
              <option value="bottom_center">Bottom center</option><option value="bottom_right">Bottom right</option>
            </select>
          </Field>
        </div>
      </Section>
    </fieldset>
  );
}

// ─── Front matter ──────────────────────────────────────────────────

const toVars = (keys: string[]) => keys.map((key) => ({ key, label: key.replace(/_/g, ' ') }));
export const LETTER_VARS = toVars([
  'client_name', 'firm_name', 'firm_city', 'firm_state', 'firm_city_state', 'accountant_signature', 'period_start_date', 'period_end_date',
  'as_of_date', 'period_description', 'basis_of_accounting', 'financial_statement_titles', 'report_date', 'report_title',
]);

export function FrontMatterPanel({ value, onChange, readOnly, library }: { value: FsFrontMatter; onChange: (v: FsFrontMatter) => void; readOnly: boolean; library: FsLibrary | undefined }) {
  const letters = (library?.letters ?? []).filter((l) => l.isActive);
  const chosen = letters.find((l) => l.id === value.letter.letterId) ?? letters.find((l) => l.isDefault) ?? letters[0];
  return (
    <fieldset disabled={readOnly} className="space-y-5 text-sm">
      <Section title="Cover page">
        <label className={check}><input type="checkbox" checked={value.cover.enabled} onChange={(e) => onChange({ ...value, cover: { ...value.cover, enabled: e.target.checked } })} />Include a cover page</label>
        {value.cover.enabled && (
          <>
            <Field label="Title"><input className={inputCls} value={value.cover.title ?? ''} placeholder="Financial Statements" onChange={(e) => onChange({ ...value, cover: { ...value.cover, title: e.target.value || undefined } })} /></Field>
            <Field label="Subtitle"><input className={inputCls} value={value.cover.subtitle ?? ''} placeholder="(optional)" onChange={(e) => onChange({ ...value, cover: { ...value.cover, subtitle: e.target.value || undefined } })} /></Field>
            <label className={`${check} text-xs`}><input type="checkbox" checked={value.cover.showFirmName !== false} onChange={(e) => onChange({ ...value, cover: { ...value.cover, showFirmName: e.target.checked } })} />Show firm name</label>
          </>
        )}
      </Section>
      <Section title="Table of contents">
        <label className={check}><input type="checkbox" checked={value.toc.enabled} onChange={(e) => onChange({ ...value, toc: { ...value.toc, enabled: e.target.checked } })} />Include a table of contents</label>
      </Section>
      <Section title="Accountant's report">
        <label className={check}><input type="checkbox" checked={value.letter.enabled} onChange={(e) => onChange({ ...value, letter: { ...value.letter, enabled: e.target.checked } })} />Include the accountant&apos;s report</label>
        {value.letter.enabled && (
          <>
            <Field label="Report template">
              <select className={inputCls} value={chosen?.id ?? ''} onChange={(e) => onChange({ ...value, letter: { ...value.letter, letterId: e.target.value ? Number(e.target.value) : null, bodyHtmlOverride: null } })}>
                {letters.map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? ' (default)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Report date" hint="Blank = today"><input type="date" className={inputCls} value={value.letter.reportDate ?? ''} onChange={(e) => onChange({ ...value, letter: { ...value.letter, reportDate: e.target.value || null } })} /></Field>
            <Field label="Title"><input className={inputCls} placeholder={chosen?.title ?? "Accountant's Compilation Report"} value={value.letter.titleOverride ?? ''} onChange={(e) => onChange({ ...value, letter: { ...value.letter, titleOverride: e.target.value || null } })} /></Field>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Wording for this engagement</span>
                {value.letter.bodyHtmlOverride
                  ? <button type="button" className={linkCls} onClick={() => onChange({ ...value, letter: { ...value.letter, bodyHtmlOverride: null } })}>Use the template wording</button>
                  : <button type="button" className={linkCls} onClick={() => onChange({ ...value, letter: { ...value.letter, bodyHtmlOverride: chosen?.bodyHtml ?? '<p></p>' } })}>Customize for this client</button>}
              </div>
              {value.letter.bodyHtmlOverride !== null && value.letter.bodyHtmlOverride !== undefined && !readOnly && (
                <div className="mt-1">
                  <RichTextEditor value={value.letter.bodyHtmlOverride} onChange={(html) => onChange({ ...value, letter: { ...value.letter, bodyHtmlOverride: html } })} variables={LETTER_VARS} ariaLabel="Accountant's report wording" />
                </div>
              )}
            </div>
          </>
        )}
      </Section>
    </fieldset>
  );
}

// ─── Cash-flow classification + equity roles ───────────────────────

const CF_LABEL: Record<FsCashFlowClass, string> = {
  cash: 'Cash', operating: 'Operating', noncash_adjustment: 'Noncash adjustment', investing: 'Investing', financing: 'Financing', excluded: 'Excluded',
};
const CF_ORDER: FsCashFlowClass[] = ['cash', 'operating', 'noncash_adjustment', 'investing', 'financing', 'excluded'];
const smallSelect = 'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 text-xs py-0.5 disabled:opacity-60';

export function CashFlowPanel({ data, onSet, readOnly }: {
  data: FsCashFlowData | undefined;
  onSet: (o: { accountId?: string | null; groupingId?: string | null; classification: FsCashFlowClass | null }) => void;
  readOnly: boolean;
}) {
  if (!data) return <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>;
  const groups = [
    ...data.leadSheets.map((ls) => ({ ls, accounts: data.accounts.filter((a) => a.leadSheetId === ls.id) })),
    { ls: null, accounts: data.accounts.filter((a) => a.leadSheetId === null) },
  ].filter((g) => g.accounts.length);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        How each balance sheet account moves into the statement of cash flows (indirect method). A choice here applies to every statement set of this client.
        Where nothing is chosen, the category set on the Cash Flow page is used, then the lead sheet&apos;s. Accumulated depreciation is added back automatically.
      </p>
      {groups.map(({ ls, accounts }) => (
        <div key={ls?.id ?? 'none'} className="rounded border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/40 px-2 py-1">
            <span className="flex-1 font-medium text-gray-800 dark:text-gray-100 truncate">{ls ? `${ls.code ? `${ls.code} — ` : ''}${ls.name}` : 'No lead sheet'}</span>
            {ls && (
              <select disabled={readOnly} className={smallSelect} aria-label={`Classification for ${ls.name}`} value={ls.override ?? ''} onChange={(e) => onSet({ groupingId: ls.id, classification: (e.target.value || null) as FsCashFlowClass | null })}>
                <option value="">Default</option>
                {CF_ORDER.map((k) => <option key={k} value={k}>{CF_LABEL[k]}</option>)}
              </select>
            )}
          </div>
          <ul className="divide-y divide-gray-50 dark:divide-gray-700/60">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-2 py-0.5 text-xs">
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{a.number} {a.name}</span>
                <select disabled={readOnly} className={smallSelect} aria-label={`Classification for ${a.name}`} value={a.override ?? ''} onChange={(e) => onSet({ accountId: a.id, classification: (e.target.value || null) as FsCashFlowClass | null })}>
                  <option value="">{CF_LABEL[a.fallback]} ({a.fallbackSource === 'chart_of_accounts' ? 'Cash Flow page' : a.fallbackSource === 'lead_sheet' ? 'lead sheet' : 'default'})</option>
                  {CF_ORDER.map((k) => <option key={k} value={k}>{CF_LABEL[k]}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!groups.length && <p className="text-xs text-gray-500 dark:text-gray-400">This client has no balance sheet accounts yet.</p>}
    </div>
  );
}

const ROLE_LABEL: Record<FsEquityRole, string> = {
  retained: 'Retained earnings', contributions: 'Contributions', distributions: 'Distributions', other: 'Other',
};
const ROLE_ORDER: FsEquityRole[] = ['retained', 'contributions', 'distributions', 'other'];

export function EquityRolesPanel({ accounts, onSet, readOnly }: {
  accounts: FsEquityRoleAccount[] | undefined;
  onSet: (r: { accountId: string; role: FsEquityRole | null; isFold?: boolean }) => void;
  readOnly: boolean;
}) {
  if (!accounts) return <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!accounts.length) return <p className="text-xs text-gray-500 dark:text-gray-400">This client has no equity accounts.</p>;
  const anyFold = accounts.some((a) => a.isFold);
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        What each equity account is, for the statement of changes in equity. Net income is closed into one account — unless you choose it,
        the lowest-numbered retained earnings account.
      </p>
      <ul className="rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/60">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-2 px-2 py-1 text-xs">
            <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300" title={`${a.number} ${a.name}`}>{a.number} {a.name}</span>
            <select disabled={readOnly} className={`${smallSelect} w-40 shrink-0`} aria-label={`Role of ${a.name}`} value={a.role ?? ''} onChange={(e) => onSet({ accountId: a.id, role: (e.target.value || null) as FsEquityRole | null })}>
              <option value="">{ROLE_LABEL[a.defaultRole]} (default)</option>
              {ROLE_ORDER.map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
            </select>
            <label className="flex items-center gap-1 shrink-0 text-gray-600 dark:text-gray-400" title="Net income is closed into this account">
              <input type="radio" name="fs-fold" disabled={readOnly} checked={a.isFold}
                onChange={() => onSet({ accountId: a.id, role: a.role ?? 'retained', isFold: true })} />
              Net income
            </label>
          </li>
        ))}
      </ul>
      {anyFold && !readOnly && (
        <button type="button" className={linkCls} onClick={() => { const f = accounts.find((a) => a.isFold)!; onSet({ accountId: f.id, role: f.role ?? 'retained', isFold: false }); }}>
          Choose the net income account automatically
        </button>
      )}
    </div>
  );
}

// ─── Checks ────────────────────────────────────────────────────────

const SEVERITY: Record<FsCheck['severity'], { mark: string; cls: string; label: string }> = {
  error: { mark: '✕', cls: 'text-red-600', label: 'Error' },
  warning: { mark: '!', cls: 'text-amber-500', label: 'Warning' },
  info: { mark: 'i', cls: 'text-blue-500', label: 'Note' },
};

export function ChecksPanel({ checks, onFocus }: { checks: FsCheck[]; onFocus: (c: FsCheck) => void }) {
  if (!checks.length) {
    return <p className="text-sm text-green-700 dark:text-green-400">Everything ties: the balance sheet balances, net income agrees with the trial balance, every account with a balance is placed, and cash flows reconcile.</p>;
  }
  return (
    <ul className="space-y-2">
      {checks.map((c, i) => {
        const s = SEVERITY[c.severity];
        return (
          <li key={i} className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button type="button" className="flex w-full items-start gap-2 p-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md" onClick={() => onFocus(c)}>
              <span className={`shrink-0 w-4 text-center font-bold ${s.cls}`} aria-label={s.label}>{s.mark}</span>
              <span className="text-gray-800 dark:text-gray-100">{c.message}</span>
            </button>
            {(c.code === 'TB_FS_UNASSIGNED' || c.code === 'TB_FS_UNBOUND_LEADSHEET') && (
              <div className="px-2 pb-2 pl-8">
                <Link to="/lead-sheets" className={linkCls}>Open Lead Sheets to assign accounts →</Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
