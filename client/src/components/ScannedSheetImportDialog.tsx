// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * "Import scanned sheet" for the Transaction Entry register.
 *
 * Upload a scanned PDF of a client's handwritten sheet → the AI transcribes the
 * line items (one call per page) → the user checks the rows against the page
 * image side by side, fixes anything flagged, and adds the accepted rows to the
 * register as UNSAVED rows. Nothing is written until the register's Save.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Account } from '../api/chartOfAccounts';
import type { Payee } from '../api/bankTransactions';
import { analyzeScannedSheet, categorizeScannedRows, type ScannedSheetAnalysisResult, type ScannedSheetRow, type UncertainField } from '../api/scannedSheetImport';
import { getOcrStatus } from '../api/settings';
import { checkFileSize } from '../utils/fileLimits';
import { evalAmountExpr } from '../utils/evalAmountExpr';
import { matchPayee, resolvePayeeAccount, type PayeeMatch } from '../utils/matchPayee';
import { matchAccountRef } from '../utils/matchAccountRef';
import { AccountSearchDropdown } from './AccountSearchDropdown';
import { AiConsentDialog, AI_PII } from './AiConsentDialog';
import { DateInput } from './DateInput';

// ── Public types ─────────────────────────────────────────────────────────────

/** What the register receives per accepted row. */
export interface ImportedDraftRow {
  sourceAccountId: number | null;
  date: string;
  ref: string;
  payee: string;
  matchedPayee: Payee | null;
  accountId: number | null;
  /** Signed cents: + money in, − money out. */
  amountCents: number;
}

interface Props {
  clientId: number;
  accounts: Account[];
  payees: Payee[];
  defaultSourceAccountId: number | null;
  /** Rows already in the register (date|payee|cents) — used for a soft duplicate warning. */
  existingRowKeys?: Set<string>;
  /** First sequence number for generated Ref### references (register continues its own run). */
  refSeed?: number;
  onClose: () => void;
  onInsert: (drafts: ImportedDraftRow[]) => void;
}

// ── Local types / helpers ────────────────────────────────────────────────────

type Stage = 'upload' | 'analyzing' | 'preview';

interface PreviewRow extends ScannedSheetRow {
  _key: number;
  include: boolean;
  /** AI-read date when plausible, else the sheet date; user-editable. */
  effectiveDate: string;
  match: PayeeMatch | null;
  /** Free text that goes into the register's Payee field (pre-filled from the scan / matched payee). */
  payeeText: string;
  /** True once the user typed in the payee box — description edits stop re-deriving it. */
  payeeEdited: boolean;
  /** True once the user set/cleared the category by hand — payee changes stop touching it. */
  categoryOverridden: boolean;
  accountId: number | null;
  /**
   * Journal-report rows only: the bank account printed on the entry, resolved
   * against the COA. Overrides the dialog's one "bank account" for that row.
   */
  sourceAccountId: number | null;
  /** Where the current category came from (drives the badge next to the dropdown). */
  categorySource: 'payee' | 'ai' | 'manual' | 'journal' | null;
  categoryConfidence: number | null;
  categoryReasoning: string | null;
}

/**
 * Default payee text = exactly what was written on the sheet (the transcription).
 * A matched known payee only drives the category suggestion; it never replaces
 * the client's wording. (`match` is accepted for call-site symmetry.)
 */
const derivePayeeText = (description: string, _match: PayeeMatch | null): string => description.trim();

/**
 * Sequence reference stamped on rows the sheet did not number itself. A sheet's
 * lines usually share one date, and the register sorts same-date rows by this
 * reference, so it is what keeps the entries in the order they were written.
 */
const seqRef = (n: number): string => `Ref${String(n).padStart(3, '0')}`;

/** A row that can actually be posted: something to describe and a non-zero amount. */
const isPostable = (r: PreviewRow): boolean => r.description.trim().length > 0 && r.amount !== 0;

let nextKey = 1;
/** Files imported this browser session — soft duplicate guard. */
const importedFileSignatures = new Set<string>();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${str})` : str;
}

function plausibleDate(d: string | null, sheetDate: string): boolean {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const a = Date.parse(d);
  const b = Date.parse(sheetDate);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) <= 366 * 86_400_000;
}

function parseAmountInput(raw: string): { cents: number; explicitSign: 'in' | 'out' | null } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const evaluated = evalAmountExpr(trimmed).replace(/[^0-9.\-]/g, '');
  const val = parseFloat(evaluated);
  if (!Number.isFinite(val)) return null;
  const explicitSign: 'in' | 'out' | null = val < 0 || /^\(.*\)$/.test(trimmed) ? 'out' : trimmed.startsWith('+') ? 'in' : null;
  return { cents: Math.round(Math.abs(val) * 100), explicitSign };
}

function confidenceBadge(c: number): React.ReactNode {
  const pct = Math.round(c * 100);
  const cls =
    c >= 0.9 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
    : c >= 0.7 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
    : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${cls}`}>{pct}%</span>;
}

function rowBorderClass(r: PreviewRow): string {
  if (!r.include) return 'border-l-4 border-l-gray-300 dark:border-l-gray-600 text-gray-400 dark:text-gray-500 bg-gray-50/60 dark:bg-gray-800/40';
  if (r.confidence >= 0.9) return 'border-l-4 border-l-green-400';
  if (r.confidence >= 0.7) return 'border-l-4 border-l-yellow-400';
  return 'border-l-4 border-l-orange-400';
}

const HOW_LABEL: Record<PayeeMatch['how'], string> = { ai: 'AI', exact: 'exact', normalized: 'match', prefix: 'prefix', tokens: 'fuzzy' };

const uncertainCls = (r: PreviewRow, f: UncertainField): string =>
  r.uncertain.includes(f) ? 'bg-amber-50 dark:bg-amber-900/20' : '';
const uncertainTitle = (r: PreviewRow, f: UncertainField): string | undefined =>
  r.uncertain.includes(f) ? 'The AI was unsure about this value — check it against the page image' : undefined;

// ── Editable cell (same behaviour as the bank-statement dialog) ──────────────

function EditableCell({
  value, display, onCommit, className = '', inputClassName = '', type = 'text', title,
}: {
  value: string;
  display: React.ReactNode;
  onCommit: (v: string) => void;
  className?: string;
  inputClassName?: string;
  type?: 'text' | 'date';
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const commit = () => { setEditing(false); if (draft !== value) onCommit(draft); };
  const cancel = () => { setEditing(false); setDraft(value); };

  if (editing) {
    return (
      <td className={className}>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') cancel();
          }}
          autoFocus
          className={`w-full bg-white dark:bg-gray-700 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 dark:text-white ${inputClassName}`}
        />
      </td>
    );
  }
  return (
    <td className={`${className} cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20`} onClick={startEdit} title={title}>
      {display}
    </td>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScannedSheetImportDialog({ clientId, accounts, payees, defaultSourceAccountId, existingRowKeys, refSeed = 1, onClose, onInsert }: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [showConsent, setShowConsent] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetDate, setSheetDate] = useState<string>(todayIso());
  const [sourceAccountId, setSourceAccountId] = useState<number | ''>(defaultSourceAccountId ?? '');
  const [useOcr, setUseOcr] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ScannedSheetAnalysisResult | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [zoomWide, setZoomWide] = useState(false);
  const [highlightKey, setHighlightKey] = useState<number | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeNote, setCategorizeNote] = useState<string | null>(null);
  const rowsRef = useRef<PreviewRow[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pagePaneRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** The sheet date rows are currently following (rows without a written date track it live). */
  const followedSheetDateRef = useRef<string>(sheetDate);

  // Abort an in-flight analyze if the dialog unmounts (user closed it while reading).
  useEffect(() => () => abortRef.current?.abort(), []);

  // The client's default account can arrive after the dialog opened — adopt it
  // as long as the user hasn't picked one.
  useEffect(() => {
    if (defaultSourceAccountId !== null) setSourceAccountId((cur) => (cur === '' ? defaultSourceAccountId : cur));
  }, [defaultSourceAccountId]);

  // Keep the page tabs in sync with manual scrolling of the image pane.
  useEffect(() => {
    if (stage !== 'preview' || !pagePaneRef.current) return;
    const root = pagePaneRef.current;
    const figures = Array.from(root.querySelectorAll<HTMLElement>('figure[id^="sheet-page-"]'));
    if (figures.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const n = Number(visible.target.id.replace('sheet-page-', ''));
        if (n) setActivePage(n);
      }
    }, { root, threshold: [0.25, 0.5, 0.75] });
    figures.forEach((f) => io.observe(f));
    return () => io.disconnect();
  }, [stage, analysis]);

  // Row highlight fades after a moment.
  useEffect(() => {
    if (highlightKey === null) return;
    const t = setTimeout(() => setHighlightKey(null), 2500);
    return () => clearTimeout(t);
  }, [highlightKey]);

  const { data: ocrStatus } = useQuery({
    queryKey: ['ocr-status'],
    queryFn: async () => (await getOcrStatus()).data,
  });
  const ocrAvailable = ocrStatus?.configured ?? false;

  // Escape closes the dialog only on the upload stage — in the preview it would
  // discard a whole review, and Escape is also how cell edits / dropdowns cancel.
  useEffect(() => {
    if (stage !== 'upload' || showConsent) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === 'Escape' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showConsent, stage]);

  // ── File handling ──────────────────────────────────────────────────────────

  const acceptPdf = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    if (!checkFileSize(file, 'pdf')) return;
    setSelectedFile(file);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    acceptPdf(e.dataTransfer.files[0]);
  };

  // ── Analyze ────────────────────────────────────────────────────────────────

  // Numbered by position in the extraction, so a Ref### maps to a line on the
  // sheet even after rows around it are unticked. A check number the AI actually
  // read off the sheet wins — that reference is real and belongs in the field.
  const buildPreviewRows = (data: ScannedSheetAnalysisResult): PreviewRow[] =>
    data.rows.map((r, i) => {
      const match = matchPayee(r.description, payees, r.matchedPayee);
      const written = r.ref?.trim();
      // A journal-report entry names its accounts; when one resolves against
      // the COA it is the category (and the bank line the source), and the
      // payee/AI passes leave it alone. An unresolved one falls through to
      // the ordinary flow like any handwritten line.
      const journalAccount = r.layout === 'journal' ? matchAccountRef(r.accountRef, accounts) : null;
      const journalSource = r.layout === 'journal' ? matchAccountRef(r.sourceAccountRef, accounts) : null;
      const payeeAccount = resolvePayeeAccount(match?.payee);
      return {
        ...r,
        ref: written || seqRef(refSeed + i),
        uncertain: written ? r.uncertain : r.uncertain.filter((u) => u !== 'ref'),
        _key: nextKey++,
        include: r.confidence >= 0.3 && r.amount !== 0,
        effectiveDate: plausibleDate(r.date, data.sheetDate) ? (r.date as string) : data.sheetDate,
        match,
        payeeText: derivePayeeText(r.description, match),
        payeeEdited: false,
        categoryOverridden: false,
        sourceAccountId: journalSource?.id ?? null,
        accountId: journalAccount?.id ?? payeeAccount,
        categorySource: journalAccount ? 'journal' : payeeAccount !== null ? 'payee' : null,
        categoryConfidence: null,
        categoryReasoning: null,
      };
    });

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setStage('analyzing');
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const res = await analyzeScannedSheet(selectedFile, clientId, { sheetDate, useOcr: useOcr || undefined, signal: controller.signal });
    if (controller.signal.aborted) return; // dialog closed while reading
    if (res.error || !res.data) {
      setError(res.error?.message ?? 'No data returned');
      setStage('upload');
      return;
    }
    setAnalysis(res.data);
    const preview = buildPreviewRows(res.data);
    setRows(preview);
    followedSheetDateRef.current = res.data.sheetDate;
    setActivePage(1);
    setStage('preview');
    // Second pass: let the AI suggest a category for anything the payee match couldn't.
    void runAiCategorize(preview.filter((r) => r.accountId === null && isPostable(r)), controller.signal);
  };

  /**
   * Ask the AI for a GL account per row (same prompt family as Bank Transactions
   * → AI classify). Only fills rows without a category unless `force` is set;
   * never overwrites a category the user set by hand.
   */
  const runAiCategorize = async (targets: PreviewRow[], signal?: AbortSignal, force = false) => {
    // A category printed on a journal report is authoritative — never re-guessed.
    const batch = targets.filter((r) => r.categorySource !== 'journal' && (force ? !r.categoryOverridden : (r.accountId === null && !r.categoryOverridden)));
    if (batch.length === 0) { setCategorizeNote(force ? 'Every row already has a category you set by hand.' : null); return; }
    setCategorizing(true);
    setCategorizeNote(null);
    let applied = 0;
    let failed = false;
    // ≤100 rows per call server-side; batch generously below that.
    for (let i = 0; i < batch.length; i += 60) {
      const chunk = batch.slice(i, i + 60);
      const res = await categorizeScannedRows(
        clientId,
        chunk.map((r) => ({ key: r._key, payee: registerPayee(r), description: r.description.trim(), amount: r.amount, date: r.effectiveDate })),
        signal,
      );
      if (signal?.aborted) return;
      if (res.error || !res.data) { failed = true; continue; }
      const byKey = new Map(res.data.suggestions.map((sg) => [sg.key, sg]));
      const eligible = (r: PreviewRow) => byKey.has(r._key) && !r.categoryOverridden && r.categorySource !== 'journal' && (force || r.accountId === null || r.categorySource === 'ai');
      applied += rowsRef.current.filter(eligible).length;
      setRows((prev) => prev.map((r) => {
        if (!eligible(r)) return r;
        const sg = byKey.get(r._key)!;
        return { ...r, accountId: sg.accountId, categorySource: 'ai', categoryConfidence: sg.confidence, categoryReasoning: sg.reasoning };
      }));
    }
    setCategorizing(false);
    setCategorizeNote(failed
      ? `AI category suggestions ${applied > 0 ? 'partly ' : ''}failed — check the AI provider settings and try again.`
      : `AI suggested categories for ${applied} row${applied !== 1 ? 's' : ''} — shown with an "AI" badge; review the low-confidence ones.`);
  };

  // ── Row editing ────────────────────────────────────────────────────────────

  const patchRow = (key: number, patch: Partial<PreviewRow>) =>
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));

  const setDescription = (row: PreviewRow, value: string) => {
    const description = value.trim();
    const patch: Partial<PreviewRow> = { description, uncertain: row.uncertain.filter((u) => u !== 'description') };
    if (!row.payeeEdited) {
      // Payee text follows the description until the user types their own.
      const match = matchPayee(description, payees, null);
      patch.match = match;
      patch.payeeText = derivePayeeText(description, match);
      // Only auto-fill the category if the user hasn't set it by hand; a
      // description that no longer matches any payee clears the stale suggestion.
      if (!row.categoryOverridden) {
        const fromPayee = resolvePayeeAccount(match?.payee);
        if (fromPayee !== null) { patch.accountId = fromPayee; patch.categorySource = 'payee'; patch.categoryConfidence = null; patch.categoryReasoning = null; }
        else if (row.categorySource !== 'ai') { patch.accountId = null; patch.categorySource = null; }
      }
    }
    patchRow(row._key, patch);
  };

  const setAmount = (row: PreviewRow, raw: string) => {
    const parsed = parseAmountInput(raw);
    if (!parsed) return;
    const direction: PreviewRow['direction'] = parsed.explicitSign ?? (row.direction === 'unknown' ? 'out' : row.direction);
    patchRow(row._key, {
      amount: direction === 'in' ? parsed.cents : -parsed.cents,
      direction,
      uncertain: row.uncertain.filter((u) => u !== 'amount' && (parsed.explicitSign ? u !== 'sign' : true)),
    });
  };

  const flipDirection = (row: PreviewRow) => {
    const direction: PreviewRow['direction'] = row.direction === 'in' ? 'out' : 'in';
    patchRow(row._key, {
      amount: direction === 'in' ? Math.abs(row.amount) : -Math.abs(row.amount),
      direction,
      uncertain: row.uncertain.filter((u) => u !== 'sign'),
    });
  };

  /** Free-text payee: whatever is typed goes to the register; known payees still drive the category suggestion. */
  const setPayeeText = (row: PreviewRow, text: string) => {
    const match = matchPayee(text, payees, null);
    patchRow(row._key, {
      payeeText: text,
      payeeEdited: true,
      match,
      ...(row.categoryOverridden
        ? {}
        : {
            accountId: resolvePayeeAccount(match?.payee) ?? (row.categorySource === 'ai' ? row.accountId : null),
            categorySource: resolvePayeeAccount(match?.payee) !== null ? 'payee' as const : row.categorySource === 'ai' ? 'ai' as const : null,
          }),
    });
  };

  const setCategory = (row: PreviewRow, id: number | '') =>
    patchRow(row._key, { accountId: id === '' ? null : id, categoryOverridden: true, categorySource: id === '' ? null : 'manual', categoryConfidence: null, categoryReasoning: null });

  /** Changing the sheet date moves every row that was still following it; rows with their own date keep it. */
  const changeSheetDate = (next: string) => {
    if (!next) return;
    const prev = followedSheetDateRef.current;
    setSheetDate(next);
    if (stage === 'preview' && next !== prev) {
      setRows((rows0) => rows0.map((r) => (r.effectiveDate === prev ? { ...r, effectiveDate: next } : r)));
      followedSheetDateRef.current = next;
    }
  };

  const applySheetDateToAll = () => { setRows((prev) => prev.map((r) => ({ ...r, effectiveDate: sheetDate }))); followedSheetDateRef.current = sheetDate; };
  const setAllInclude = (include: boolean) => setRows((prev) => prev.map((r) => ({ ...r, include })));
  const includeOnlyConfident = () => setRows((prev) => prev.map((r) => ({ ...r, include: r.confidence >= 0.5 && r.amount !== 0 })));

  const scrollToPage = (page: number, key?: number) => {
    setActivePage(page);
    if (key !== undefined) setHighlightKey(key);
    const el = pagePaneRef.current?.querySelector<HTMLElement>(`#sheet-page-${page}`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const included = useMemo(() => rows.filter((r) => r.include && isPostable(r)), [rows]);
  const skippedUnpostable = rows.filter((r) => r.include && !isPostable(r)).length;
  const totalIn = included.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = included.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
  const lowConfCount = rows.filter((r) => r.confidence < 0.5).length;
  /** What lands in the register's Payee field: the payee box, falling back to the description. */
  const registerPayee = (r: PreviewRow): string => r.payeeText.trim() || r.description.trim();

  const dupKeys = useMemo(() => {
    const set = new Set<number>();
    if (!existingRowKeys || existingRowKeys.size === 0) return set;
    for (const r of rows) {
      if (existingRowKeys.has(`${r.effectiveDate}|${registerPayee(r).toLowerCase()}|${r.amount}`)) set.add(r._key);
    }
    return set;
  }, [rows, existingRowKeys]);
  const duplicateCount = included.filter((r) => dupKeys.has(r._key)).length;
  const fileSig = selectedFile ? `${selectedFile.name}|${selectedFile.size}|${selectedFile.lastModified}` : '';
  const fileSeenBefore = !!fileSig && importedFileSignatures.has(fileSig);

  // ── Insert ─────────────────────────────────────────────────────────────────

  const handleInsert = () => {
    if (included.length === 0) return;
    onInsert(included.map((r) => ({
      sourceAccountId: r.sourceAccountId ?? (sourceAccountId === '' ? null : sourceAccountId),
      date: r.effectiveDate,
      ref: r.ref ?? '',
      payee: registerPayee(r),
      matchedPayee: r.match?.payee ?? null,
      accountId: r.accountId,
      amountCents: r.amount,
    })));
    if (fileSig) importedFileSignatures.add(fileSig);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isPreview = stage === 'preview' && analysis;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full flex flex-col ${isPreview ? 'max-w-[100rem] h-[92vh]' : 'max-w-2xl max-h-[90vh]'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import scanned sheet</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isPreview
                ? `${analysis.processedPages} page${analysis.processedPages !== 1 ? 's' : ''} · ${rows.length} line${rows.length !== 1 ? 's' : ''} read · ${analysis.ocrMode ? 'OCR + AI' : analysis.visionMode ? 'AI vision' : 'PDF text'} · check each row against the page, then add to the register`
                : 'A handwritten (or typed) sheet with a description and amount per line — the AI reads it, you review, then Save on the register.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* ── Stage: upload ─────────────────────────────────────────────── */}
        {stage === 'upload' && (
          <div className="px-5 py-4 overflow-auto space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => acceptPdf(e.target.files?.[0])} className="hidden" />
              <div className="text-3xl mb-2">&#128221;</div>
              {selectedFile ? (
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Drop the scanned PDF here, or click to browse</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Handwritten or typed sheets · up to 10 pages per import</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sheet date</label>
                <DateInput
                  value={sheetDate}
                  onChange={(e) => changeSheetDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Used for every line unless a date is written on it. You can change dates per row after.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Bank / source account</label>
                <AccountSearchDropdown accounts={accounts} value={sourceAccountId} onChange={setSourceAccountId} placeholder="Select the bank account…" />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Pre-fills the Account column; you can still change it per row in the register.</p>
              </div>
            </div>

            {fileSeenBefore && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                ⚠ This file looks like one you already imported this session — reading it again will add the rows a second time.
              </div>
            )}

            {ocrAvailable && selectedFile && (
              <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded p-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span>Use OCR pre-processing</span>
                  <span className="text-xs text-gray-400">(local OCR — {ocrStatus?.model})</span>
                </label>
                {useOcr && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 ml-6">
                    OCR reads each page locally (~30–60 s/page) before the AI structures the lines. Vision mode is usually better for handwriting.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              The AI reads every line (description, amount, and whether it is money in or out) and flags anything it is unsure about. You verify against the page image before rows are added.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
              <button
                onClick={() => setShowConsent(true)}
                disabled={!selectedFile || !sheetDate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Read sheet
              </button>
            </div>
            {showConsent && (
              <AiConsentDialog
                feature="AI Scanned Sheet Import"
                piiItems={[
                  ...AI_PII.scannedSheet,
                  ...(useOcr ? [{ label: 'OCR processing', detail: 'Page images will also be sent to the configured OCR server (llama.cpp or Ollama) for text extraction before AI analysis' }] : []),
                ]}
                onCancel={() => setShowConsent(false)}
                onConfirm={() => { setShowConsent(false); void handleAnalyze(); }}
              />
            )}
          </div>
        )}

        {/* ── Stage: analyzing ──────────────────────────────────────────── */}
        {stage === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <span className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg font-medium">{useOcr ? 'Running OCR, then reading the sheet…' : 'Reading the sheet…'}</p>
            <p className="text-sm mt-1">{useOcr ? 'OCR takes 30–60 seconds per page.' : 'About 10–20 seconds per page.'}</p>
          </div>
        )}

        {/* ── Stage: preview ────────────────────────────────────────────── */}
        {isPreview && (
          <>
            <div className="flex-1 flex min-h-0">
              {/* Left: page images */}
              <div className="w-[34%] border-r dark:border-gray-700 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900/40">
                <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-gray-700 text-xs shrink-0">
                  <span className="text-gray-500 dark:text-gray-400">Page</span>
                  {analysis.pages.map((p) => (
                    <button
                      key={p.page}
                      type="button"
                      onClick={() => scrollToPage(p.page)}
                      className={`px-2 py-0.5 rounded border ${activePage === p.page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      {p.page}
                    </button>
                  ))}
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setZoomWide((z) => !z)}
                    className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Toggle zoom"
                  >
                    {zoomWide ? 'Fit width' : 'Zoom 150%'}
                  </button>
                </div>
                <div ref={pagePaneRef} className="flex-1 overflow-auto p-3 space-y-4">
                  {analysis.pages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-xs text-gray-400 dark:text-gray-500 px-6">
                      Page preview unavailable — the PDF text layer was used, or the server has no poppler-utils installed. Compare against your original.
                    </div>
                  ) : (
                    analysis.pages.map((p) => (
                      <figure key={p.page} id={`sheet-page-${p.page}`}>
                        <figcaption className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">Page {p.page}</figcaption>
                        <img
                          src={p.imageDataUrl}
                          alt={`Scanned page ${p.page}`}
                          className={`border border-gray-200 dark:border-gray-700 rounded shadow-sm bg-white ${zoomWide ? 'w-[150%] max-w-none' : 'w-full'}`}
                        />
                      </figure>
                    ))
                  )}
                </div>
              </div>

              {/* Right: extracted rows */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {/* Toolbar */}
                <div className="px-4 py-2 border-b dark:border-gray-700 shrink-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <span>Sheet date</span>
                      <DateInput
                        value={sheetDate}
                        onChange={(e) => changeSheetDate(e.target.value)}
                        title="Rows without a date written on the sheet follow this date"
                        className="px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                      />
                      <button type="button" onClick={applySheetDateToAll} title="Also overwrite rows that have their own written date" className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Apply to all rows</button>
                    </label>
                    <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <span>Account</span>
                      <div className="w-56">
                        <AccountSearchDropdown accounts={accounts} value={sourceAccountId} onChange={setSourceAccountId} placeholder="Bank account…" className="text-xs" />
                      </div>
                    </label>
                    <span className="flex-1" />
                    <span className="text-gray-500 dark:text-gray-400">
                      In <span className="font-mono text-green-700 dark:text-green-400">{fmt(totalIn)}</span>
                      &nbsp;· Out <span className="font-mono text-red-600 dark:text-red-400">{fmt(-totalOut)}</span>
                      &nbsp;· Net <span className={`font-mono ${totalIn - totalOut < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{fmt(totalIn - totalOut)}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <span>
                      {included.length} of {rows.length} included
                      {skippedUnpostable > 0 && <span className="text-amber-600 dark:text-amber-400"> · {skippedUnpostable} checked but blank/zero — will be skipped</span>}
                    </span>
                    <span>·</span>
                    <button type="button" onClick={() => setAllInclude(true)} className="underline hover:text-gray-700 dark:hover:text-gray-200">all</button>
                    <button type="button" onClick={() => setAllInclude(false)} className="underline hover:text-gray-700 dark:hover:text-gray-200">none</button>
                    <button type="button" onClick={includeOnlyConfident} className="underline hover:text-gray-700 dark:hover:text-gray-200">only ≥ 50% confidence</button>
                    <span>·</span>
                    <button
                      type="button"
                      disabled={categorizing || rows.length === 0}
                      onClick={() => void runAiCategorize(rowsRef.current.filter(isPostable), undefined, false)}
                      className="px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                      title="Ask the AI to suggest a category for every row that doesn't have one yet"
                    >
                      {categorizing ? 'AI categorising…' : 'AI: fill missing categories'}
                    </button>
                    <button
                      type="button"
                      disabled={categorizing || rows.length === 0}
                      onClick={() => void runAiCategorize(rowsRef.current.filter(isPostable), undefined, true)}
                      className="underline hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
                      title="Re-run the AI on all rows except ones where you picked the category yourself"
                    >
                      re-suggest all
                    </button>
                    {categorizeNote && <span className="text-indigo-700 dark:text-indigo-300">{categorizeNote}</span>}
                    <span className="flex-1" />
                    <span>Amber cells = the AI was unsure · click a cell to edit · click a row number to jump to its page</span>
                  </div>
                </div>

                {/* Warnings */}
                {(analysis.warnings.length > 0 || lowConfCount > 0 || fileSeenBefore || duplicateCount > 0) && (
                  <div className="mx-4 mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5 shrink-0 max-h-24 overflow-auto">
                    {fileSeenBefore && <div>⚠ This file looks like one you already imported this session.</div>}
                    {duplicateCount > 0 && <div>⚠ {duplicateCount} included row{duplicateCount !== 1 ? 's look' : ' looks'} identical (date, description, amount) to a row already in the register.</div>}
                    {lowConfCount > 0 && <div>⚠ {lowConfCount} row{lowConfCount !== 1 ? 's are' : ' is'} below 50% confidence — check the scan quality or enable OCR if this is most of the sheet.</div>}
                    {analysis.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                  </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-auto px-4 pt-2 pb-48">
                  {rows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400 gap-2">
                      <p className="font-medium">No line items were found on this sheet.</p>
                      <p className="text-xs">Try a clearer scan, or enable OCR pre-processing (Settings → OCR) if the vision model struggles with this handwriting.</p>
                    </div>
                  ) : (
                    <>
                    <datalist id="scanned-sheet-payees">
                      {payees.map((p) => <option key={p.payee} value={p.payee} />)}
                    </datalist>
                    <table className="w-full min-w-[54rem] text-xs border-collapse">
                      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10">
                        <tr className="text-left text-gray-600 dark:text-gray-300">
                          <th className="px-1.5 py-1.5 w-6"></th>
                          <th className="px-1.5 py-1.5 w-12 font-semibold" title="page / line">pg/ln</th>
                          <th className="px-1.5 py-1.5 w-24 font-semibold">Date</th>
                          <th className="px-1.5 py-1.5 font-semibold">Description</th>
                          <th className="px-1.5 py-1.5 w-14 font-semibold">Ref</th>
                          <th className="px-1.5 py-1.5 w-22 text-right font-semibold">Amount</th>
                          <th className="px-1.5 py-1.5 w-12 font-semibold">In/Out</th>
                          <th className="px-1.5 py-1.5 w-40 font-semibold" title="Goes into the register's Payee field exactly as typed. Pre-filled with what was written on the sheet; known payees are suggested as you type but never substituted automatically.">Payee</th>
                          <th className="px-1.5 py-1.5 w-52 font-semibold">Category</th>
                          <th className="px-1.5 py-1.5 w-11 font-semibold">Conf</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr
                            key={r._key}
                            className={`border-b border-gray-100 dark:border-gray-700 ${rowBorderClass(r)} ${highlightKey === r._key ? 'ring-1 ring-inset ring-blue-400' : ''}`}
                          >
                            <td className="px-1.5 py-1 align-middle">
                              <input
                                type="checkbox"
                                checked={r.include}
                                onChange={() => patchRow(r._key, { include: !r.include })}
                                className="rounded border-gray-300"
                                title={!isPostable(r) ? 'Needs a description and a non-zero amount before it can be added' : undefined}
                              />
                            </td>
                            <td className="px-1.5 py-1 align-middle">
                              <button type="button" onClick={() => scrollToPage(r.page, r._key)} className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline" title="Show this page">
                                {r.page}/{r.line}
                              </button>
                            </td>
                            <EditableCell
                              type="date"
                              value={r.effectiveDate}
                              display={<span className="font-mono dark:text-gray-200">{r.effectiveDate}</span>}
                              onCommit={(v) => { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) patchRow(r._key, { effectiveDate: v, uncertain: r.uncertain.filter((u) => u !== 'date') }); }}
                              className={`px-1.5 py-1 align-middle whitespace-nowrap ${uncertainCls(r, 'date')}`}
                              title={uncertainTitle(r, 'date')}
                            />
                            <EditableCell
                              value={r.description}
                              display={
                                <span className={r.description ? 'dark:text-gray-200' : 'text-gray-400 italic'} title={r.rawText ?? undefined}>
                                  {r.description || '— blank —'}
                                  {dupKeys.has(r._key) && (
                                    <span className="ml-1 px-1 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="A row with the same date, description and amount is already in the register">dup</span>
                                  )}
                                  {r.include && !isPostable(r) && (
                                    <span className="ml-1 px-1 rounded text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300" title="Needs a description and a non-zero amount">skipped</span>
                                  )}
                                </span>
                              }
                              onCommit={(v) => setDescription(r, v)}
                              className={`px-1.5 py-1 align-middle ${uncertainCls(r, 'description')}`}
                              title={uncertainTitle(r, 'description') ?? (r.rawText ? `Raw: ${r.rawText}` : undefined)}
                            />
                            <EditableCell
                              value={r.ref ?? ''}
                              display={<span className="font-mono dark:text-gray-300">{r.ref ?? ''}</span>}
                              onCommit={(v) => patchRow(r._key, { ref: v.trim() || null, uncertain: r.uncertain.filter((u) => u !== 'ref') })}
                              className={`px-1.5 py-1 align-middle ${uncertainCls(r, 'ref')}`}
                              title={uncertainTitle(r, 'ref')}
                            />
                            <EditableCell
                              value={(Math.abs(r.amount) / 100).toFixed(2)}
                              display={
                                <span className={`font-mono tabular-nums ${r.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{fmt(r.amount)}</span>
                              }
                              onCommit={(v) => setAmount(r, v)}
                              className={`px-1.5 py-1 align-middle text-right whitespace-nowrap ${uncertainCls(r, 'amount')}`}
                              inputClassName="text-right font-mono"
                              title={uncertainTitle(r, 'amount')}
                            />
                            <td className={`px-1.5 py-1 align-middle ${uncertainCls(r, 'sign')}`} title={uncertainTitle(r, 'sign')}>
                              <button
                                type="button"
                                onClick={() => flipDirection(r)}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                                  r.uncertain.includes('sign')
                                    ? 'border-amber-400 text-amber-700 dark:text-amber-300'
                                    : r.direction === 'in'
                                      ? 'border-green-300 text-green-700 dark:text-green-400'
                                      : 'border-red-300 text-red-600 dark:text-red-400'
                                }`}
                                title="Click to flip between money in and money out"
                              >
                                {r.direction === 'in' ? 'in' : 'out'}{r.uncertain.includes('sign') ? '?' : ''}
                              </button>
                            </td>
                            <td className="px-1.5 py-1 align-middle">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  list="scanned-sheet-payees"
                                  value={r.payeeText}
                                  onChange={(e) => setPayeeText(r, e.target.value)}
                                  placeholder={r.description.trim() || 'Payee'}
                                  className="w-full min-w-0 px-1 py-0.5 text-[11px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                                  title={r.match ? `Looks like known payee "${r.match.payee.payee}" (${HOW_LABEL[r.match.how]}) — its rule / most-used category is suggested; the text itself stays as written` : 'Not a known payee yet — will be created on Save'}
                                />
                                <span
                                  className={`text-[10px] shrink-0 ${r.match ? 'text-gray-400 dark:text-gray-500' : 'text-blue-500 dark:text-blue-400'}`}
                                  title={r.match ? `Matched by ${HOW_LABEL[r.match.how]}` : 'New payee'}
                                >
                                  {r.match ? HOW_LABEL[r.match.how] : 'new'}
                                </span>
                              </div>
                            </td>
                            <td className="px-1.5 py-1 align-middle">
                              <div className="flex items-center gap-1">
                                <AccountSearchDropdown
                                  accounts={accounts}
                                  value={r.accountId ?? ''}
                                  onChange={(id) => setCategory(r, id)}
                                  placeholder="— category —"
                                  className="text-[11px] flex-1 min-w-0"
                                />
                                {r.accountId !== null && r.categorySource === 'ai' && (
                                  <span
                                    className={`shrink-0 px-1 rounded text-[10px] font-medium ${
                                      (r.categoryConfidence ?? 0) >= 0.7
                                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                    }`}
                                    title={`AI suggestion${r.categoryConfidence !== null ? ` (${Math.round(r.categoryConfidence * 100)}%)` : ''}${r.categoryReasoning ? `: ${r.categoryReasoning}` : ''}`}
                                  >
                                    AI{r.categoryConfidence !== null ? ` ${Math.round(r.categoryConfidence * 100)}%` : ''}
                                  </span>
                                )}
                                {r.accountId !== null && r.categorySource === 'payee' && (
                                  <span className="shrink-0 px-1 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300" title="From this payee's rule / most-used category">payee</span>
                                )}
                                {r.accountId !== null && r.categorySource === 'journal' && (
                                  <span className="shrink-0 px-1 rounded text-[10px] font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" title={`Account printed on the journal report: ${r.accountRef ?? ''}`}>journal</span>
                                )}
                              </div>
                            </td>
                            <td className="px-1.5 py-1 align-middle">{confidenceBadge(r.confidence)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t dark:border-gray-700 shrink-0">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Rows are added to the register <strong>unsaved</strong> — review them there and press Save to post. Rows without a category won't save until you pick one there.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => { setStage('upload'); setError(null); }} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Back</button>
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
                <button
                  onClick={handleInsert}
                  disabled={included.length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add {included.length} row{included.length !== 1 ? 's' : ''} to register
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
