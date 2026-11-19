// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Owner 2026-11-19: a closed (locked) period refuses every write to its
 * data. Every write route and MCP tool is classified here, read from the
 * source, so a new one cannot skip the question; each LOCKED route's handler
 * must call a lock guard. `test/fs-e2e.mjs` fires the routes at a locked
 * period. Adding a route: put it in one list, and if it writes a period's
 * data, guard it (`assertPeriodUnlocked(id, trx)` or `assertPeriodsOpen(trx, ids)`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const ROUTES = path.join(__dirname, '..', '..', 'routes');
const MCP = path.join(__dirname, '..', '..', 'mcp', 'server.ts');

/** `file router METHOD path` → refuses a closed period. */
const LOCKED_ROUTES = [
  'bankTransactions.ts btCollectionRouter POST /',
  'bankTransactions.ts btCollectionRouter POST /import',
  'bankTransactions.ts btCollectionRouter POST /manual',
  'bankTransactions.ts btCollectionRouter POST /batch-delete',
  'bankTransactions.ts btCollectionRouter POST /batch-classify',
  'bankTransactions.ts btCollectionRouter POST /batch-update-source',
  'bankTransactions.ts btCollectionRouter POST /batch-confirm-ai',
  'bankTransactions.ts btCollectionRouter PATCH /:id',
  'bankTransactions.ts btCollectionRouter DELETE /:id',
  'bankStatementPdfImport.ts bankStatementPdfRouter POST /confirm',
  'csvImport.ts csvImportRouter POST /confirm',
  'pdfImport.ts pdfImportRouter POST /confirm',
  'qboImport.ts qboImportRouter POST /confirm',
  'documents.ts documentsItemRouter DELETE /:id',
  'journalEntries.ts jeItemRouter POST /',
  'journalEntries.ts jeItemRouter PUT /:id/lines',
  'journalEntries.ts jeItemRouter PATCH /:id',
  'journalEntries.ts jeItemRouter DELETE /:id',
  'leadSheetAttachments.ts leadSheetAttachmentCollectionRouter POST /',
  'leadSheetAttachments.ts leadSheetAttachmentItemRouter POST /annotations',
  'leadSheetAttachments.ts leadSheetAttachmentItemRouter DELETE /',
  'leadSheets.ts leadSheetItemRouter DELETE /',
  'leadSheets.ts leadSheetPeriodRouter POST /:leadSheetId/unsign',
  'leadSheets.ts leadSheetPeriodRouter POST /:leadSheetId/notes',
  'leadSheets.ts leadSheetPeriodRouter POST /:leadSheetId/notes/:noteId/resolve',
  'periods.ts periodItemRouter PATCH /:id',
  'pyComparison.ts pyComparisonRouter POST /manual',
  'pyComparison.ts pyComparisonRouter POST /confirm-csv',
  'pyComparison.ts pyComparisonRouter POST /confirm-pdf',
  'pyComparison.ts pyComparisonRouter DELETE /',
  'pyComparison.ts pyComparisonRouter POST /create-aje',
  'reconciliations.ts reconciliationCollectionRouter POST /',
  'reconciliations.ts reconciliationItemRouter PATCH /',
  'reconciliations.ts reconciliationItemRouter POST /toggle-item',
  'reconciliations.ts reconciliationItemRouter POST /complete',
  'reconciliations.ts reconciliationItemRouter POST /reopen',
  'reconciliations.ts reconciliationItemRouter DELETE /',
  'tickmarks.ts tickmarkLibraryItemRouter DELETE /',
  'tickmarks.ts tbTickmarkRouter POST /toggle',
  'trialBalance.ts tbPeriodRouter POST /initialize',
  'trialBalance.ts tbPeriodRouter POST /import',
  'trialBalance.ts tbPeriodRouter POST /import-prior-year',
  'trialBalance.ts tbPeriodRouter PUT /:accountId',
  'taxWorkpapers.ts m1CollectionRouter POST /',
  'taxWorkpapers.ts m1ItemRouter PATCH /',
  'taxWorkpapers.ts m1ItemRouter DELETE /',
  'engagement.ts engagementCollectionRouter POST /',
  'engagement.ts engagementItemRouter PATCH /',
  'engagement.ts engagementItemRouter DELETE /',
  'comparison.ts comparisonRouter PUT /variance-notes/:accountId',
  'varianceNotes.ts varianceNotesRouter PUT /:accountId',
];

/** Writes that SKIP rows of a closed period instead of refusing. */
const LOCK_SKIPPING_ROUTES = [
  'bankTransactions.ts btCollectionRouter POST /ai-classify',
];

/** Files none of whose write routes change a period's data, and why. */
const OTHER_FILES: Record<string, string> = {
  'auth.ts': "the caller's own account",
  'passkeys.ts': "the caller's own account",
  'passwordReset.ts': 'account passwords',
  'totp.ts': "the caller's own account",
  'trustedBrowsers.ts': "the caller's own account",
  'users.ts': 'users',
  'settings.ts': 'firm settings',
  'storage.ts': 'storage configuration and folder links',
  'support.ts': 'support conversations',
  'clients.ts': 'clients (deactivate is soft)',
  'chartOfAccounts.ts': 'the chart (client level)',
  'coaTemplates.ts': 'firm templates; apply refuses a client with trial balance rows',
  'taxCodes.ts': 'tax codes',
  'taxLineAssignment.ts': "the chart's tax lines (client level)",
  'units.ts': "the chart's units (client level)",
  'savedReports.ts': 'saved report definitions',
  'qboIntegration.ts': 'QuickBooks connection',
  'mcpHttp.ts': 'the MCP transport; its tools are classified below',
  'scannedSheetImport.ts': 'reads a scan; writes nothing',
  'diagnostics.ts': 'reads and asks the AI; writes nothing',
  'exports.ts': 'consolidation settings, by client',
  'pdfReports.ts': 'a merged workpaper PDF saved as a client document',
  'rollForward.ts': 'reads the source period (a closed one is the usual case) and makes a new period',
  'fs.ts': 'Statement Writer: statements are prepared after close (deliberate, lib/fs/fsReports.ts)',
};

/** Single write routes in mixed files that are not period data or are exempt, and why. */
const OTHER_ROUTES: Record<string, string> = {
  'bankTransactions.ts btRulesRouter DELETE /:id': 'classification rules (client)',
  'bankStatementPdfImport.ts bankStatementPdfRouter POST /analyze': 'parses a statement; writes nothing',
  'csvImport.ts csvImportRouter POST /analyze': 'parse only',
  'csvImport.ts csvImportRouter POST /suggest-numbers': 'AI suggestion only',
  'csvImport.ts csvImportRouter POST /chat': 'AI chat only',
  'pdfImport.ts pdfImportRouter POST /analyze': 'parse only',
  'pdfImport.ts pdfImportRouter POST /suggest-numbers': 'AI suggestion only',
  'pdfImport.ts pdfImportRouter POST /chat': 'AI chat only',
  'pdfImport.ts pdfImportRouter POST /verify/:importId': "an import's verification fields",
  'qboImport.ts qboImportRouter POST /preview': 'a pending import row; confirm is guarded',
  'qboImport.ts qboImportRouter POST /suggest-matches': 'AI suggestion only',
  'qboImport.ts qboImportRouter POST /suggest-numbers': 'AI suggestion only',
  'documents.ts documentsCollectionRouter POST /': 'a client document (not period data)',
  'documents.ts documentsItemRouter PUT /:id/link': "a client document's link",
  'leadSheets.ts leadSheetCollectionRouter POST /seed': 'client lead sheets',
  'leadSheets.ts leadSheetCollectionRouter POST /': 'client lead sheets',
  'leadSheets.ts leadSheetCollectionRouter POST /reorder': 'client lead sheets',
  'leadSheets.ts leadSheetCollectionRouter POST /assign': "the chart's lead sheets (client level)",
  'leadSheets.ts leadSheetCollectionRouter POST /auto-assign/preview': 'reads',
  'leadSheets.ts leadSheetCollectionRouter POST /auto-assign/confirm': "the chart's lead sheets (client level)",
  'leadSheets.ts leadSheetItemRouter PATCH /': 'a client lead sheet',
  'leadSheets.ts leadSheetPeriodRouter POST /:leadSheetId/signoff': 'deliberate: a sign-off adds evidence to a closed period',
  'periods.ts periodCollectionRouter POST /': 'a new period',
  'periods.ts periodItemRouter POST /:id/lock': 'the lock itself',
  'periods.ts periodItemRouter POST /:id/unlock': 'admin unlock',
  'periods.ts periodItemRouter DELETE /:id': 'deliberate: an admin may delete a locked period',
  'tickmarks.ts tickmarkLibraryCollectionRouter POST /': 'client tickmark library',
  'tickmarks.ts tickmarkLibraryItemRouter PATCH /': 'client tickmark library',
  'tickmarks.ts systemTickmarkCollectionRouter POST /': 'system tickmarks',
  'tickmarks.ts systemTickmarkCollectionRouter POST /apply/:clientId': 'copies system tickmarks into a client library',
  'tickmarks.ts systemTickmarkItemRouter PATCH /': 'system tickmarks',
  'tickmarks.ts systemTickmarkItemRouter DELETE /': 'system tickmarks',
  'backup.ts backupRouter POST /full': 'reads',
  'backup.ts backupRouter POST /settings': 'reads',
  'backup.ts backupRouter POST /client/:clientId': 'reads',
  'backup.ts backupRouter POST /period/:periodId': 'reads',
  'backup.ts backupRouter DELETE /:backupId': 'a backup file',
  'backup.ts restoreRouter POST /upload': 'stages a file',
  'backup.ts restoreRouter POST /execute': 'admin restore: replaces a client from its archive, locks included',
};

/** MCP tools that write a period's data (each must reach a lock guard). */
const MCP_LOCKED_TOOLS = ['update_trial_balance_row', 'create_journal_entry', 'add_variance_note', 'update_engagement_task'];
const MCP_OTHER: Record<string, string> = {
  lock_period: 'the lock itself',
  list_clients: 'reads', get_period_dashboard: 'reads', get_trial_balance: 'reads', list_journal_entries: 'reads',
  get_chart_of_accounts: 'reads', get_tax_mapping_status: 'reads', auto_assign_tax_codes: "the chart's tax codes (client level)",
  confirm_tax_assignments: "the chart's tax codes (client level)", run_diagnostics: 'reads', search_accounts: 'reads',
  get_period_comparison: 'reads', list_engagement_tasks: 'reads', generate_report_url: 'reads',
  period_review: 'a prompt', tax_mapping_review: 'a prompt', variance_investigation: 'a prompt', engagement_status: 'a prompt',
  full_period_close: 'a prompt',
};

/**
 * What counts as reaching the lock: a guard, or a helper in the same file
 * that is itself checked below to call one.
 */
const GUARD = /\b(assertPeriodUnlocked|assertPeriodsOpen|lockAndListClosed|PERIOD_LOCKED)\b/;
const GUARDED_HELPERS = ['syncTxJE', 'assertReconPeriodOpen', 'reconciliationPeriodLocked', 'upsertTrialBalance', 'createJournalEntry'];

interface Found { key: string; file: string; body: string }

function writeRoutes(): Found[] {
  const out: Found[] = [];
  for (const f of fs.readdirSync(ROUTES).filter((n) => n.endsWith('.ts')).sort()) {
    const src = fs.readFileSync(path.join(ROUTES, f), 'utf8');
    const re = /\b(\w+)\.(get|post|put|patch|delete)\(\s*(['`])([^'`]*)\3/g;
    const hits: Array<{ key: string | null; at: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      hits.push({ key: m[2] === 'get' ? null : `${f} ${m[1]} ${m[2].toUpperCase()} ${m[4]}`, at: m.index });
    }
    hits.forEach((h, i) => {
      if (h.key) out.push({ key: h.key, file: f, body: src.slice(h.at, hits[i + 1]?.at ?? src.length) });
    });
  }
  return out;
}

function reachesGuard(body: string): boolean {
  return GUARD.test(body) || GUARDED_HELPERS.some((h) => new RegExp(`\\b${h}\\(`).test(body));
}

test('every write route is classified as closed-period data or not, exactly once', () => {
  const found = writeRoutes().map((r) => r.key);
  assert.ok(found.length > 150, `found ${found.length} write routes: the pattern still matches`);
  const unclassified = found.filter((r) => {
    const file = r.split(' ')[0]!;
    const listed = [LOCKED_ROUTES.includes(r), LOCK_SKIPPING_ROUTES.includes(r), r in OTHER_ROUTES, file in OTHER_FILES].filter(Boolean).length;
    return listed !== 1;
  });
  assert.deepEqual(unclassified, [], 'classify each in periodLockRoutes.test.ts (once)');
  const stale = [...LOCKED_ROUTES, ...LOCK_SKIPPING_ROUTES, ...Object.keys(OTHER_ROUTES)].filter((r) => !found.includes(r));
  assert.deepEqual(stale, [], 'listed routes that no longer exist');
});

test('every closed-period route reaches a lock guard', () => {
  const routes = writeRoutes();
  const missing = [...LOCKED_ROUTES, ...LOCK_SKIPPING_ROUTES].filter((key) => {
    const r = routes.find((x) => x.key === key);
    return !r || !reachesGuard(r.body);
  });
  assert.deepEqual(missing, [], 'these handlers call no lock guard');
});

test('the helpers counted as guards call one themselves', () => {
  const sources = [
    ...fs.readdirSync(ROUTES).filter((n) => n.endsWith('.ts')).map((n) => path.join(ROUTES, n)),
    ...fs.readdirSync(path.join(__dirname, '..', '..', 'mcp', 'services')).filter((n) => n.endsWith('.ts')).map((n) => path.join(__dirname, '..', '..', 'mcp', 'services', n)),
  ].map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  for (const h of GUARDED_HELPERS) {
    const at = sources.search(new RegExp(`(async function|function|const) ${h}\\b`));
    assert.ok(at >= 0, `${h} is defined`);
    assert.ok(GUARD.test(sources.slice(at, at + 4000)), `${h} calls a lock guard`);
  }
});

test('every MCP tool is classified, and the writing ones reach a lock guard', () => {
  const src = fs.readFileSync(MCP, 'utf8');
  const cases = [...src.matchAll(/case '(\w+)':/g)];
  const tools = cases.map((m) => m[1]!);
  assert.ok(tools.length >= 20);
  const unclassified = tools.filter((t) => [MCP_LOCKED_TOOLS.includes(t), t in MCP_OTHER].filter(Boolean).length !== 1);
  assert.deepEqual(unclassified, []);
  const missing = MCP_LOCKED_TOOLS.filter((t) => {
    const i = cases.findIndex((m) => m[1] === t);
    const body = src.slice(cases[i]!.index!, cases[i + 1]?.index ?? src.length);
    return !reachesGuard(body);
  });
  assert.deepEqual(missing, [], 'these MCP tools call no lock guard');
});
