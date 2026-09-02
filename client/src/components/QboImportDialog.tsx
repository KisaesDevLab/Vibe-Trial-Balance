// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Import from QuickBooks Online: fetch the company's TrialBalance report for
 * the period, review how every QuickBooks account lands on the chart of
 * accounts, then confirm.
 *
 * The browser never sends amounts — decisions only route rows; the server
 * re-derives every cent from the report it stored at preview time.
 *
 * `target="prior"` reuses the whole flow for the PY Tie-Out: the server pulls
 * the prior year's report and the confirm lands in the uploaded-PY column
 * instead of the unadjusted one. Only the copy and the zero-absent step differ.
 *
 * Rows the server placed by exact name are badged "by name" so the reviewer
 * looks at them; the opt-in "Suggest matches with AI" button (consent first,
 * names and categories only) fills the rest as badged SUGGESTIONS the
 * reviewer can change — nothing is written on the model's say-so. Zero-balance
 * rows start skipped: QuickBooks lists every account with activity, and a
 * zero line has nothing to import.
 */

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import {
  previewQboImport,
  confirmQboImport,
  suggestQboMatches,
  QBO_SUGGEST_CHUNK_SIZE,
  type QboSuggestConfidence,
  type QboAccountingMethod,
  type QboPreviewResult,
  type QboPreviewRow,
  type QboImportDecision,
  type QboDecisionAction,
  type QboExceptionReason,
  type QboImportTarget,
} from '../api/qbo';
import { AccountSearchDropdown } from './AccountSearchDropdown';
import { AiConsentDialog, AI_PII } from './AiConsentDialog';
import { useFeatures } from '../hooks/useFeatures';
import { pushToast } from '../store/uiStore';

interface QboImportDialogProps {
  periodId: number;
  clientId: number;
  /** Where the balances land; defaults to the period's unadjusted columns. */
  target?: QboImportTarget;
  onClose: () => void;
  onSuccess: () => void;
}

type Stage = 'fetch' | 'preview';

/** A preview row plus the reviewer's edits. */
interface EditableRow extends QboPreviewRow {
  decision: QboDecisionAction;
  /** Remembered when a row is unticked so re-ticking restores it. */
  preSkipDecision: Exclude<QboDecisionAction, 'skip'>;
  /** Set when the current match came from the AI pass; cleared the moment the reviewer changes it. */
  aiConfidence: QboSuggestConfidence | null;
}

const isZero = (r: QboPreviewRow): boolean => r.debitCents === 0 && r.creditCents === 0;

const CATEGORIES: Array<Account['category']> = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

const EXCEPTION_TEXT: Record<QboExceptionReason, string> = {
  NO_ACCOUNT_ID: 'QuickBooks reported this line without an account id — pick the account it belongs to, or leave it out.',
  ACCT_NUM_BOUND_ELSEWHERE: 'An account with this number is already linked to a different QuickBooks account — pick where this one goes.',
  DUPLICATE_ACCT_NUM: 'Another QuickBooks account on this report already claims this account number.',
};

const WARNING_TEXT: Record<string, string> = {
  OUT_OF_BALANCE: 'QuickBooks reported debits that do not equal credits.',
  SUMMARY_MISSING: 'The report carried no totals row; the totals shown were summed from its lines.',
  NO_REPORT_DATA: 'QuickBooks returned no rows for these dates.',
  START_DATE_DIFFERS: "QuickBooks used a different start date than the period's — the company's first fiscal month may not match.",
  END_DATE_DIFFERS: "QuickBooks used a different end date than the period's.",
};

function fmtCents(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initialDecision(r: QboPreviewRow): Exclude<QboDecisionAction, 'skip'> {
  return r.action === 'create_new' ? 'create_new' : 'match';
}

function toEditable(r: QboPreviewRow, skipZero: boolean): EditableRow {
  const pre = initialDecision(r);
  // An exception has nowhere to go until the reviewer says so — it starts skipped.
  const skip = r.action === 'exception' || (skipZero && isZero(r));
  return { ...r, decision: skip ? 'skip' : pre, preSkipDecision: pre, aiConfidence: null };
}

function rowBorderClass(r: EditableRow): string {
  if (r.decision === 'skip') return r.action === 'exception' ? 'border-l-4 border-l-red-400 opacity-70' : 'border-l-4 border-l-gray-300 opacity-50';
  if (r.decision === 'create_new') return 'border-l-4 border-l-blue-400';
  if (r.aiConfidence) return 'border-l-4 border-l-indigo-400';
  if (r.action === 'exception') return 'border-l-4 border-l-red-400';
  if (r.matchType === 'qbo_id') return 'border-l-4 border-l-green-400';
  if (r.matchType === 'name') return 'border-l-4 border-l-orange-400';
  return 'border-l-4 border-l-yellow-400';
}

const CONFIDENCE_CLS: Record<QboSuggestConfidence, string> = {
  high: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  medium: 'bg-indigo-50 dark:bg-indigo-900/25 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700',
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-dashed border-indigo-300 dark:border-indigo-700',
};

function actionBadge(r: EditableRow): React.ReactNode {
  if (r.decision === 'skip') {
    return r.action === 'exception'
      ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">Needs review</span>
      : <span className="text-xs text-gray-400 italic">skip</span>;
  }
  if (r.decision === 'create_new') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">New</span>;
  }
  if (r.action === 'match' && r.matchType === 'qbo_id') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" title="Linked to this QuickBooks account on a previous import">linked</span>;
  }
  if (r.action === 'match' && r.matchType === 'acct_num') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400" title="Matched by account number — the link is saved on confirm">by number</span>;
  }
  if (r.aiConfidence) {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${CONFIDENCE_CLS[r.aiConfidence]}`} title="Suggested by AI from the account names — check it; the link is saved on confirm">
        AI · {r.aiConfidence}
      </span>
    );
  }
  if (r.action === 'match' && r.matchType === 'name') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400" title="The account names are identical — check it; the link is saved on confirm">by name</span>;
  }
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400" title="Account chosen by hand">manual</span>;
}

const selectCls =
  'text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

export function QboImportDialog({ periodId, clientId, target = 'current', onClose, onSuccess }: QboImportDialogProps) {
  const isPrior = target === 'prior';
  const [stage, setStage] = useState<Stage>('fetch');
  const [methodChoice, setMethodChoice] = useState<'default' | QboAccountingMethod>('default');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [preview, setPreview] = useState<QboPreviewResult | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  // The AI pass edits rows between awaits; the ref sees the reviewer's edits made meanwhile.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [zeroAbsent, setZeroAbsent] = useState(true);
  const [acknowledgeUnbalanced, setAcknowledgeUnbalanced] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [skipZero, setSkipZero] = useState(true);
  const features = useFeatures();
  const [showAiConsent, setShowAiConsent] = useState(false);
  const [suggesting, setSuggesting] = useState<{ done: number; total: number } | null>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', clientId],
    queryFn: async () => {
      const r = await listAccounts(clientId);
      return r.data ?? [];
    },
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await previewQboImport({
        periodId,
        clientId,
        target,
        ...(methodChoice === 'default' ? {} : { accountingMethod: methodChoice }),
      });
      if (res.error || !res.data) throw new Error(res.error?.message ?? 'QuickBooks preview failed');
      setPreview(res.data);
      setRows(res.data.rows.map((r) => toEditable(r, skipZero)));
      setAcknowledgeUnbalanced(false);
      setConfirmError(null);
      setStage('preview');
    } catch (e) {
      setFetchError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  // ── Row editing ────────────────────────────────────────────────────────────

  const updateRow = (idx: number, patch: Partial<EditableRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  /** Apply a decision to one row, keeping the pre-skip memory and seeding new-account fields. */
  const withDecision = (r: EditableRow, decision: QboDecisionAction): EditableRow => {
    if (decision === 'skip') {
      return { ...r, decision: 'skip', preSkipDecision: r.decision === 'skip' ? r.preSkipDecision : r.decision };
    }
    if (decision === 'create_new') {
      // Exceptions arrive without new-account fields; seed them from the QuickBooks row.
      return {
        ...r,
        decision,
        preSkipDecision: decision,
        newAccountNumber: r.newAccountNumber ?? r.qboAcctNum,
        newAccountName: r.newAccountName ?? r.qboName,
      };
    }
    return { ...r, decision, preSkipDecision: decision };
  };

  const setDecision = (idx: number, decision: QboDecisionAction) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? withDecision(r, decision) : r)));

  const toggleInclude = (idx: number, include: boolean) =>
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      if (!include) return withDecision(r, 'skip');
      // An unresolved exception cannot come back as a match with no account; make it a new account.
      const restored = r.preSkipDecision === 'match' && !r.matchedAccountId ? 'create_new' : r.preSkipDecision;
      return withDecision(r, restored);
    }));

  const pickAccount = (idx: number, id: number | '') => {
    const acct = id === '' ? null : accounts.find((a) => a.id === id) ?? null;
    updateRow(idx, {
      matchedAccountId: acct?.id ?? null,
      matchedAccountNumber: acct?.account_number ?? null,
      matchedAccountName: acct?.account_name ?? null,
      aiConfidence: null,
    });
  };

  /** Skip (or restore) every zero-balance row; exceptions stay skipped until placed by hand. */
  const toggleSkipZero = (on: boolean) => {
    setSkipZero(on);
    setRows((prev) => prev.map((r) => {
      if (!isZero(r) || r.action === 'exception') return r;
      if (on) return withDecision(r, 'skip');
      if (r.decision !== 'skip') return r;
      const restored = r.preSkipDecision === 'match' && !r.matchedAccountId ? 'create_new' : r.preSkipDecision;
      return withDecision(r, restored);
    }));
  };

  // ── AI suggestions ─────────────────────────────────────────────────────────

  /** Rows the AI pass may fill: unplaced, carrying a QuickBooks id, and not already sent somewhere by the reviewer. */
  const aiEligible = (r: EditableRow): boolean =>
    r.qboAccountId !== null &&
    r.action !== 'match' &&
    (r.decision === 'create_new' || (r.decision === 'skip' && r.action === 'exception'));

  const aiEligibleCount = rows.filter(aiEligible).length;

  const runSuggestions = async () => {
    if (!preview) return;
    const keys = rows.filter(aiEligible).map((r) => r.rowKey);
    if (keys.length === 0) return;
    setSuggesting({ done: 0, total: keys.length });
    const counts: Record<QboSuggestConfidence, number> = { high: 0, medium: 0, low: 0 };
    try {
      for (let i = 0; i < keys.length; i += QBO_SUGGEST_CHUNK_SIZE) {
        const chunk = keys.slice(i, i + QBO_SUGGEST_CHUNK_SIZE);
        const res = await suggestQboMatches({ importId: preview.importId, rowKeys: chunk });
        if (res.error || !res.data) throw new Error(res.error?.message ?? 'AI suggestions failed');
        const byKey = new Map(res.data.suggestions.map((sg) => [sg.rowKey, sg]));
        // Applied against the rows as they are NOW: a row the reviewer placed
        // while the call ran is theirs, and an account taken by hand meanwhile is not reused.
        const current = rowsRef.current;
        const used = new Set(current.filter((r) => r.decision === 'match' && r.matchedAccountId).map((r) => r.matchedAccountId!));
        const next = current.map((r): EditableRow => {
          const sg = byKey.get(r.rowKey);
          if (!sg || !aiEligible(r) || used.has(sg.accountId)) return r;
          used.add(sg.accountId);
          counts[sg.confidence]++;
          return {
            ...r,
            decision: 'match',
            preSkipDecision: 'match',
            matchedAccountId: sg.accountId,
            matchedAccountNumber: sg.accountNumber,
            matchedAccountName: sg.accountName,
            aiConfidence: sg.confidence,
          };
        });
        rowsRef.current = next;
        setRows(next);
        setSuggesting({ done: Math.min(i + chunk.length, keys.length), total: keys.length });
      }
      const total = counts.high + counts.medium + counts.low;
      pushToast(
        total === 0
          ? 'AI found no existing account for the remaining rows'
          : `AI suggested ${total} match${total === 1 ? '' : 'es'} (${counts.high} high · ${counts.medium} medium · ${counts.low} low) — review each before importing`,
        'success',
      );
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSuggesting(null);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let included = 0;
    let created = 0;
    let unresolved = 0;
    let missingNumber = 0;
    for (const r of rows) {
      if (r.decision === 'skip') continue;
      included++;
      debit += r.debitCents;
      credit += r.creditCents;
      if (r.decision === 'create_new') {
        created++;
        if (!(r.newAccountNumber ?? '').trim()) missingNumber++;
      }
      if (r.decision === 'match' && !r.matchedAccountId) unresolved++;
    }
    return { debit, credit, included, created, unresolved, missingNumber, skipped: rows.length - included };
  }, [rows]);

  const zeroCount = useMemo(() => rows.filter(isZero).length, [rows]);
  const aiCount = useMemo(() => rows.filter((r) => r.aiConfidence && r.decision === 'match').length, [rows]);

  const exceptionCount = rows.filter((r) => r.action === 'exception').length;
  const reportUnbalanced = preview?.warnings.includes('OUT_OF_BALANCE') ?? false;
  const otherWarnings = (preview?.warnings ?? []).filter((w) => w !== 'OUT_OF_BALANCE');
  const canConfirm =
    !confirming &&
    totals.included + (zeroAbsent ? (preview?.absentNonzero.length ?? 0) : 0) > 0 &&
    totals.unresolved === 0 &&
    totals.missingNumber === 0 &&
    (!reportUnbalanced || acknowledgeUnbalanced);

  // ── Confirm ────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const decisions: QboImportDecision[] = rows.map((r) =>
        r.decision === 'skip'
          ? { rowKey: r.rowKey, action: 'skip' }
          : r.decision === 'match'
            ? { rowKey: r.rowKey, action: 'match', matchedAccountId: r.matchedAccountId }
            : {
                rowKey: r.rowKey,
                action: 'create_new',
                newAccountNumber: r.newAccountNumber,
                newAccountName: r.newAccountName,
                newCategory: r.newCategory,
                newNormalBalance: r.newNormalBalance,
              },
      );
      const res = await confirmQboImport({
        importId: preview.importId,
        decisions,
        zeroAbsent,
        ...(reportUnbalanced ? { acknowledgeUnbalanced } : {}),
      });
      if (res.error || !res.data) throw new Error(res.error?.message ?? 'Import failed');
      const r = res.data;
      const parts = [isPrior ? `Imported ${r.rowsImported} prior year balances from QuickBooks` : `Imported ${r.rowsImported} balances from QuickBooks`];
      if (r.accountsCreated > 0) parts.push(`${r.accountsCreated} new account${r.accountsCreated === 1 ? '' : 's'}`);
      if (r.accountsZeroed > 0) parts.push(`${r.accountsZeroed} zeroed`);
      if (r.qboIdsLinked > 0) parts.push(`${r.qboIdsLinked} linked by number`);
      pushToast(parts.join(' · '), 'success');
      if (r.accountsWithoutTaxCodes > 0) {
        pushToast(`${r.accountsWithoutTaxCodes} new account${r.accountsWithoutTaxCodes === 1 ? ' has' : 's have'} no tax code — use Auto-assign on Tax Mapping`, 'success');
      }
      onSuccess();
    } catch (e) {
      setConfirmError((e as Error).message);
    } finally {
      setConfirming(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const dialogWidth = stage === 'preview' ? 'w-[90vw] max-w-6xl max-h-[90vh]' : 'w-full max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-modal="true" className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col ${dialogWidth}`}>

        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isPrior ? 'Prior year from QuickBooks' : 'Import from QuickBooks'}</h2>
            {preview && stage === 'preview' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {preview.companyName} · {preview.header.startPeriod ?? preview.params.start_date} to {preview.header.endPeriod ?? preview.params.end_date} · {preview.accountingMethod} basis
                {preview.priorRange && (
                  <> · {preview.priorRange.source === 'period' ? `dates of period "${preview.priorRange.priorPeriodName}"` : "this period's dates, one year earlier"}</>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {/* Stage 1: fetch */}
        {stage === 'fetch' && (
          <div className="p-6 space-y-4">
            {isPrior ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Pulls the <span className="font-medium">prior year's</span> Trial Balance report from the client's connected QuickBooks company as the bookkeeper's final prior-year balances, to compare against the rolled-forward figures. The prior period's own dates are used when this client has one; otherwise this period's dates are moved back a year.
              </p>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Pulls the Trial Balance report for this period's dates from the client's connected QuickBooks company into the <span className="font-medium">unadjusted</span> column.
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Accounting method</label>
              <select
                value={methodChoice}
                onChange={(e) => setMethodChoice(e.target.value as 'default' | QboAccountingMethod)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="default">As reported by QuickBooks (company preference)</option>
                <option value="Accrual">Accrual</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded p-3 space-y-1">
              <p>Balances arrive exactly as QuickBooks states them — including any adjusting entries already posted there. Nothing is written back to QuickBooks.</p>
              {isPrior ? (
                <>
                  <p>QuickBooks reports the prior year <span className="font-medium">before its close</span>: net income still sits in the income and expense accounts, while the rolled balances here have already closed it into equity. Expect an offsetting variance in retained earnings and the P&amp;L accounts — that is the close, not a bookkeeping difference.</p>
                  <p>This replaces any prior year data already uploaded for this period. Accounts QuickBooks omits show a variance against their rolled balance.</p>
                </>
              ) : (
                <p>QuickBooks omits zero-balance accounts; accounts that carry a balance here but are missing from the report can be zeroed in the next step.</p>
              )}
            </div>
            {fetchError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-2 text-sm text-red-700 dark:text-red-400">{fetchError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
              <button
                onClick={handleFetch}
                disabled={fetching}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fetching ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Fetching from QuickBooks…
                  </span>
                ) : isPrior ? 'Fetch prior year' : 'Fetch trial balance'}
              </button>
            </div>
          </div>
        )}

        {/* Stage 2: preview */}
        {stage === 'preview' && preview && (
          <>
            <div className="flex-1 overflow-auto px-6 py-3 space-y-3">
              {otherWarnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded p-2 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                  {otherWarnings.map((w) => <p key={w}>⚠️ {WARNING_TEXT[w] ?? w}</p>)}
                </div>
              )}
              {exceptionCount > 0 && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-2 text-xs text-red-700 dark:text-red-400">
                  {exceptionCount} row{exceptionCount === 1 ? '' : 's'} could not be placed automatically. They are left out unless you pick an account or create a new one.
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={skipZero} onChange={(e) => toggleSkipZero(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600" />
                  Skip zero-balance accounts{zeroCount > 0 && <span className="text-gray-400">({zeroCount})</span>}
                </label>
                <div className="flex items-center gap-3">
                  {aiCount > 0 && <span className="text-indigo-700 dark:text-indigo-300">{aiCount} AI suggestion{aiCount === 1 ? '' : 's'} to review</span>}
                  {features?.ai && (
                    <button
                      type="button"
                      onClick={() => setShowAiConsent(true)}
                      disabled={!!suggesting || aiEligibleCount === 0}
                      title={aiEligibleCount === 0 ? 'Every included row already has a place' : `Ask the AI which existing account each of the ${aiEligibleCount} unplaced rows is — names and categories only`}
                      className="px-3 py-1 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {suggesting ? (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          Suggesting… {suggesting.done}/{suggesting.total}
                        </span>
                      ) : `Suggest matches with AI (${aiEligibleCount})`}
                    </button>
                  )}
                </div>
              </div>

              <div className="border dark:border-gray-700 rounded overflow-auto max-h-[52vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 w-8 border-b dark:border-gray-700" />
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">QuickBooks account</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">Acct #</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">Action</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">Chart of accounts</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">Debit</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.rowKey} className={`${rowBorderClass(r)} hover:bg-gray-50 dark:hover:bg-gray-700/40`}>
                        <td className="px-2 py-1.5 text-center border-b dark:border-gray-700">
                          <input
                            type="checkbox"
                            checked={r.decision !== 'skip'}
                            onChange={(e) => toggleInclude(idx, e.target.checked)}
                            aria-label={`Include ${r.qboFullName} in the import`}
                            title={r.decision === 'skip' ? 'Excluded — check to import this row' : 'Included — uncheck to leave this row out'}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 align-middle"
                          />
                        </td>
                        <td className="px-3 py-1.5 border-b dark:border-gray-700 max-w-xs dark:text-gray-300">
                          <div className="truncate" title={r.qboFullName}>{r.qboFullName}</div>
                          {r.classification && <div className="text-[10px] text-gray-400">{r.classification}</div>}
                          {r.action === 'exception' && r.exceptionReason && (
                            <div className="text-[11px] text-red-600 dark:text-red-400 whitespace-normal">{EXCEPTION_TEXT[r.exceptionReason]}</div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs border-b dark:border-gray-700">
                          {r.decision === 'create_new' ? (
                            <input
                              type="text"
                              value={r.newAccountNumber ?? ''}
                              onChange={(e) => updateRow(idx, { newAccountNumber: e.target.value })}
                              placeholder={r.qboAcctNum ?? 'e.g. 1000'}
                              className="w-24 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          ) : (
                            <span className="text-gray-600 dark:text-gray-400">{r.qboAcctNum ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-b dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            {actionBadge(r)}
                            <select
                              value={r.decision}
                              onChange={(e) => setDecision(idx, e.target.value as QboDecisionAction)}
                              className={selectCls}
                            >
                              <option value="match">Match</option>
                              <option value="create_new">Create new</option>
                              <option value="skip">Skip</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 border-b dark:border-gray-700">
                          {r.decision === 'match' && (
                            <AccountSearchDropdown
                              accounts={accounts}
                              value={r.matchedAccountId ?? ''}
                              onChange={(id) => pickAccount(idx, id)}
                              placeholder="Select account…"
                              className="w-full"
                            />
                          )}
                          {r.decision === 'create_new' && (
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={r.newAccountName ?? ''}
                                onChange={(e) => updateRow(idx, { newAccountName: e.target.value })}
                                placeholder={r.qboName}
                                className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              />
                              <select
                                value={r.newCategory ?? ''}
                                onChange={(e) => updateRow(idx, { newCategory: e.target.value || null })}
                                className={selectCls}
                              >
                                <option value="">category…</option>
                                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <select
                                value={r.newNormalBalance ?? ''}
                                onChange={(e) => updateRow(idx, { newNormalBalance: e.target.value || null })}
                                className={selectCls}
                              >
                                <option value="">DR/CR</option>
                                <option value="debit">DR</option>
                                <option value="credit">CR</option>
                              </select>
                            </div>
                          )}
                          {r.decision === 'skip' && <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums border-b dark:border-gray-700 dark:text-gray-300">{fmtCents(r.debitCents)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums border-b dark:border-gray-700 dark:text-gray-300">{fmtCents(r.creditCents)}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-400">QuickBooks returned no balances for these dates.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {preview.absentNonzero.length > 0 && (
                <div className="border dark:border-gray-700 rounded p-3 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={zeroAbsent} onChange={(e) => setZeroAbsent(e.target.checked)} className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600" />
                    <span className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Zero {preview.absentNonzero.length} account{preview.absentNonzero.length === 1 ? '' : 's'} QuickBooks no longer reports.</span>{' '}
                      These carry a balance here but are absent from the report — QuickBooks drops zero-balance accounts, so leaving them would keep stale amounts.
                    </span>
                  </label>
                  <ul className="mt-2 ml-6 space-y-0.5 text-gray-600 dark:text-gray-400 max-h-24 overflow-auto">
                    {preview.absentNonzero.map((a) => (
                      <li key={a.accountId} className="font-mono">
                        {a.accountNumber} {a.accountName} — {a.debitCents ? `DR ${fmtCents(a.debitCents)}` : `CR ${fmtCents(a.creditCents)}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 mb-2 flex-wrap">
                <span>{totals.included} of {rows.length} rows to import</span>
                <span className="text-gray-400">|</span>
                <span>{totals.created} new account{totals.created === 1 ? '' : 's'}</span>
                <span className="text-gray-400">|</span>
                <span>{totals.skipped} skipped</span>
                <span className="text-gray-400">|</span>
                <span className="font-mono tabular-nums">DR {fmtCents(totals.debit)} · CR {fmtCents(totals.credit)}</span>
                {totals.unresolved > 0 && <span className="text-red-600 dark:text-red-400">{totals.unresolved} match{totals.unresolved === 1 ? '' : 'es'} without an account</span>}
                {totals.missingNumber > 0 && <span className="text-red-600 dark:text-red-400">{totals.missingNumber} new account{totals.missingNumber === 1 ? '' : 's'} without a number</span>}
              </div>

              {reportUnbalanced && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded p-2 text-xs text-amber-700 dark:text-amber-400 mb-2">
                  <p>⚠️ {WARNING_TEXT.OUT_OF_BALANCE} Debits {fmtCents(preview.totals.debitCents)}, credits {fmtCents(preview.totals.creditCents)} — off by {fmtCents(Math.abs(preview.totals.imbalanceCents))}. The company file should be checked in QuickBooks.</p>
                  <label className="flex items-center gap-2 mt-1 cursor-pointer">
                    <input type="checkbox" checked={acknowledgeUnbalanced} onChange={(e) => setAcknowledgeUnbalanced(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600" />
                    Import it anyway
                  </label>
                </div>
              )}

              {confirmError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-2 text-sm text-red-700 dark:text-red-400 mb-3">{confirmError}</div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
                <button
                  onClick={() => setStage('fetch')}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming ? (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importing…
                    </span>
                  ) : isPrior ? 'Save prior year balances' : 'Confirm import'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showAiConsent && (
        <AiConsentDialog
          feature="QuickBooks account matching"
          piiItems={AI_PII.qboMatch}
          onCancel={() => setShowAiConsent(false)}
          onConfirm={() => { setShowAiConsent(false); void runSuggestions(); }}
        />
      )}
    </div>
  );
}
