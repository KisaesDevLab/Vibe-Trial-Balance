"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfImportRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.pdfImportRouter = (0, express_1.Router)();
exports.pdfImportRouter.use(auth_1.authMiddleware);
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
async function getAnthropicClient() {
    const setting = await (0, db_1.db)('settings').where({ key: 'claude_api_key' }).first('value');
    const apiKey = setting?.value ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error('Claude API key not configured');
    return new sdk_1.default({ apiKey });
}
// ── POST /api/v1/import/pdf/analyze ─────────────────────────────────────────
exports.pdfImportRouter.post('/analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ data: null, error: { code: 'NO_FILE', message: 'No file uploaded' } });
            return;
        }
        const periodId = Number(req.body.periodId);
        const clientId = Number(req.body.clientId);
        if (isNaN(periodId) || isNaN(clientId)) {
            res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'periodId and clientId are required' } });
            return;
        }
        // Extract text from PDF
        let extractedText = '';
        try {
            const parsed = await (0, pdf_parse_1.default)(req.file.buffer);
            extractedText = parsed.text ?? '';
        }
        catch (_parseErr) {
            res.status(400).json({ data: null, error: { code: 'PDF_PARSE_ERROR', message: 'Could not parse PDF file. Please ensure it is a valid PDF.' } });
            return;
        }
        // Detect if text-based or scanned
        const textLength = extractedText.replace(/\s/g, '').length;
        if (textLength < 100) {
            res.status(422).json({
                data: null,
                error: {
                    code: 'SCANNED_PDF',
                    message: 'Scanned PDF not supported yet, please use a text-based PDF',
                },
            });
            return;
        }
        // Load client COA
        const coa = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .select('id', 'account_number', 'account_name', 'category', 'normal_balance')
            .orderBy('account_number');
        const coaSummary = coa.map((a) => `${a.id}|${a.account_number}|${a.account_name}|${a.category}|${a.normal_balance}`).join('\n');
        // Truncate extracted text if very long (keep first ~8000 chars for token budget)
        const truncatedText = extractedText.length > 8000 ? extractedText.slice(0, 8000) + '\n...(truncated)' : extractedText;
        const prompt = `You are an expert accountant. Extract trial balance data from this financial statement document.

DOCUMENT TEXT:
\`\`\`
${truncatedText}
\`\`\`

CLIENT'S CHART OF ACCOUNTS (format: id|account_number|account_name|category|normal_balance):
\`\`\`
${coaSummary || '(no accounts yet)'}
\`\`\`

Analyze the document and return ONLY a valid JSON object (no prose, no markdown, no code fences) with this exact structure:
{
  "documentType": "trial_balance",
  "detectedPeriod": "FY 2024",
  "matches": [
    {
      "pdfAccountName": "Cash",
      "pdfAmount": "15,000.00",
      "isDebit": true,
      "debitCents": 1500000,
      "creditCents": 0,
      "matchedAccountId": 42,
      "matchedAccountNumber": "1000",
      "matchedAccountName": "Cash - Operating",
      "confidence": 0.95,
      "matchType": "exact",
      "action": "match",
      "category": "assets"
    }
  ],
  "warnings": []
}

Rules:
- documentType: "trial_balance" if it's a trial balance, "pl" if it's an income statement/P&L, "balance_sheet" if it's a balance sheet
- detectedPeriod: extract the fiscal year or period from the document header if present, otherwise null
- For each line item (skip headers, subtotals, total rows, blank lines), produce one match object
- pdfAmount: the raw amount string as it appears in the document
- isDebit: true if this is a debit balance (assets, expenses normally), false if credit balance (liabilities, equity, revenue normally)
- debitCents and creditCents: integer cents (multiply dollars by 100). Only one should be non-zero.
- Parentheses negatives like (1,234.56) represent negative amounts. For P&L: parentheses on revenue = debit; for Balance Sheet: parentheses on assets = credit.
- For comparative statements (multiple columns), use the FIRST/CURRENT YEAR column only.
- For P&L: revenue line items have creditCents > 0 (isDebit=false); expense line items have debitCents > 0 (isDebit=true)
- For Balance Sheet: asset line items have debitCents > 0; liability/equity line items have creditCents > 0
- matchedAccountId: use the id from the COA if confident match, else null
- confidence: 0-1 where 1=exact account number match, 0.8=same number different name, 0.7=fuzzy name match, 0=no match
- matchType: "exact" (same account number), "fuzzy" (name/partial match), "none" (no match)
- action: "match" if matched to COA, "create_new" if no match but looks like a real account, "skip" if subtotal/header/total/blank
- category: your best guess at "assets", "liabilities", "equity", "revenue", or "expenses" based on the account name and document section
- warnings: array of strings for any issues found (e.g., "Document appears to be comparative — using current year column")
- Include ALL line items including those with action="skip"`;
        const anthropic = await getAnthropicClient();
        const aiMessage = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });
        const raw = aiMessage.content[0].text.trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'AI returned invalid format' } });
            return;
        }
        const analysisResult = JSON.parse(jsonMatch[0]);
        res.json({
            data: {
                ...analysisResult,
                extractedTextLength: textLength,
            },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// ── POST /api/v1/import/pdf/confirm ─────────────────────────────────────────
exports.pdfImportRouter.post('/confirm', async (req, res) => {
    try {
        const { periodId, clientId, matches, aiExtraction } = req.body;
        if (!periodId || !clientId || !Array.isArray(matches)) {
            res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'periodId, clientId, and matches are required' } });
            return;
        }
        // Check period exists and belongs to client
        const period = await (0, db_1.db)('periods').where({ id: periodId, client_id: clientId }).first();
        if (!period) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
            return;
        }
        // Check period is not locked
        if (period.locked_at) {
            res.status(403).json({ data: null, error: { code: 'PERIOD_LOCKED', message: 'Period is locked' } });
            return;
        }
        let accountsCreated = 0;
        let accountsMatched = 0;
        let rowsImported = 0;
        let rowsSkipped = 0;
        // Process each match
        for (const match of matches) {
            if (match.action === 'skip') {
                rowsSkipped++;
                continue;
            }
            let accountId = match.matchedAccountId;
            // Create new account if needed
            if (match.action === 'create_new' || (match.action === 'match' && !accountId)) {
                if (!match.pdfAccountName) {
                    rowsSkipped++;
                    continue;
                }
                // Determine category and normal_balance
                const category = match.category || 'expenses';
                const normalBalance = category === 'assets' || category === 'expenses' ? 'debit' : 'credit';
                try {
                    const [newAccount] = await (0, db_1.db)('chart_of_accounts')
                        .insert({
                        client_id: clientId,
                        account_number: `IMPORT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        account_name: match.pdfAccountName,
                        category,
                        normal_balance: normalBalance,
                        is_active: true,
                    })
                        .returning('id');
                    accountId = newAccount.id;
                    accountsCreated++;
                }
                catch (_insertErr) {
                    rowsSkipped++;
                    continue;
                }
            }
            else {
                accountsMatched++;
            }
            if (!accountId) {
                rowsSkipped++;
                continue;
            }
            // Upsert into trial_balance
            await (0, db_1.db)('trial_balance')
                .insert({
                period_id: periodId,
                account_id: accountId,
                unadjusted_debit: match.debitCents,
                unadjusted_credit: match.creditCents,
                updated_by: req.user.userId,
                updated_at: db_1.db.fn.now(),
            })
                .onConflict(['period_id', 'account_id'])
                .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at']);
            rowsImported++;
        }
        // Record in document_imports
        await (0, db_1.db)('document_imports').insert({
            client_id: clientId,
            period_id: periodId,
            import_type: 'pdf',
            document_type: 'trial_balance',
            status: 'confirmed',
            ai_extraction: JSON.stringify(aiExtraction ?? null),
            imported_by: req.user.userId,
            imported_at: db_1.db.fn.now(),
        });
        res.json({
            data: {
                accountsMatched,
                accountsCreated,
                rowsImported,
                rowsSkipped,
                total: matches.length,
            },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// ── GET /api/v1/import/pdf/imports?periodId=X ────────────────────────────────
exports.pdfImportRouter.get('/imports', async (req, res) => {
    try {
        const periodId = Number(req.query.periodId);
        if (isNaN(periodId) || periodId <= 0) {
            res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'periodId query param required' } });
            return;
        }
        const imports = await (0, db_1.db)('document_imports')
            .where({ period_id: periodId })
            .select('id', 'import_type', 'document_type', 'status', 'imported_at')
            .orderBy('imported_at', 'desc');
        res.json({ data: imports, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// ── POST /api/v1/import/pdf/verify/:importId ─────────────────────────────────
exports.pdfImportRouter.post('/verify/:importId', async (req, res) => {
    try {
        const importId = Number(req.params.importId);
        const { periodId } = req.body;
        if (isNaN(importId) || !periodId) {
            res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'importId and periodId are required' } });
            return;
        }
        // Load document_imports record
        const docImport = await (0, db_1.db)('document_imports').where({ id: importId, period_id: periodId }).first();
        if (!docImport) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Import record not found for this period' } });
            return;
        }
        // Load adjusted trial balance from view
        const tbRows = await (0, db_1.db)('v_adjusted_trial_balance')
            .where({ period_id: periodId, is_active: true })
            .select('account_number', 'account_name', 'book_adjusted_debit', 'book_adjusted_credit');
        // Build TB summary (net balance in cents)
        const tbSummary = tbRows.map((r) => {
            const dr = Number(r.book_adjusted_debit ?? 0);
            const cr = Number(r.book_adjusted_credit ?? 0);
            return {
                account_name: String(r.account_name ?? ''),
                account_number: String(r.account_number ?? ''),
                balance_cents: dr - cr,
            };
        });
        // Parse ai_extraction
        let aiExtraction = null;
        try {
            if (typeof docImport.ai_extraction === 'string') {
                aiExtraction = JSON.parse(docImport.ai_extraction);
            }
            else if (docImport.ai_extraction && typeof docImport.ai_extraction === 'object') {
                aiExtraction = docImport.ai_extraction;
            }
        }
        catch {
            // ignore parse error
        }
        // Build PDF summary from ai_extraction.matches
        const pdfSummary = (aiExtraction?.matches ?? [])
            .filter((m) => m.action !== 'skip')
            .map((m) => ({
            pdfAccountName: m.pdfAccountName,
            accountNumber: m.matchedAccountNumber ?? '',
            debitCents: m.debitCents,
            creditCents: m.creditCents,
            net: m.debitCents - m.creditCents,
        }));
        const prompt = `You are an expert accountant performing a verification of a trial balance import.

Compare the following two summaries LINE BY LINE and identify matches and discrepancies.

PDF SOURCE DATA (what was imported from the source document):
${JSON.stringify(pdfSummary, null, 2)}

ADJUSTED TRIAL BALANCE (current book-adjusted balances in the system, amounts in cents):
${JSON.stringify(tbSummary, null, 2)}

Match accounts by account_number if available, otherwise by account name (fuzzy).
A "match" means the PDF net amount (debitCents - creditCents) equals the TB balance_cents within $1 (100 cents rounding tolerance).
A "discrepancy" means the amounts differ by more than 100 cents.
"missing_from_tb" means the PDF has the account but the TB does not.
"extra_in_tb" means the TB has the account but the PDF does not.

Return ONLY a valid JSON object (no prose, no markdown, no code fences) with this exact structure:
{
  "overallStatus": "verified",
  "summary": { "total": 16, "matched": 14, "discrepancies": 2, "missingFromTb": 0, "extraInTb": 2 },
  "details": [
    {
      "accountName": "Cash",
      "accountNumber": "1000",
      "pdfAmount": 15000000,
      "tbAmount": 15000000,
      "difference": 0,
      "status": "match",
      "severity": "none"
    }
  ]
}

Rules:
- overallStatus: "verified" if no discrepancies or missing_from_tb, otherwise "discrepancies"
- severity: "none" for matches, "low" for difference < $100 (10000 cents), "medium" for $100-$1000 (100000 cents), "high" for > $1000 (100000 cents)
- Include ALL accounts from both PDF and TB in details
- For extra_in_tb: pdfAmount = null, tbAmount = actual TB amount
- For missing_from_tb: pdfAmount = actual PDF amount, tbAmount = null`;
        const anthropic = await getAnthropicClient();
        const aiMessage = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });
        const raw = aiMessage.content[0].text.trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'AI returned invalid format' } });
            return;
        }
        const verificationResult = JSON.parse(jsonMatch[0]);
        // Store result and update status
        await (0, db_1.db)('document_imports')
            .where({ id: importId })
            .update({
            verification_result: JSON.stringify(verificationResult),
            status: verificationResult.overallStatus,
            verified_by: req.user.userId,
            verified_at: db_1.db.fn.now(),
        });
        res.json({ data: verificationResult, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// ── GET /api/v1/import/pdf/verify/:importId ──────────────────────────────────
exports.pdfImportRouter.get('/verify/:importId', async (req, res) => {
    try {
        const importId = Number(req.params.importId);
        if (isNaN(importId)) {
            res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'Invalid importId' } });
            return;
        }
        const docImport = await (0, db_1.db)('document_imports').where({ id: importId }).first();
        if (!docImport) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Import not found' } });
            return;
        }
        if (!docImport.verification_result) {
            res.status(404).json({ data: null, error: { code: 'NOT_VERIFIED', message: 'Not verified yet' } });
            return;
        }
        let verificationResult;
        try {
            if (typeof docImport.verification_result === 'string') {
                verificationResult = JSON.parse(docImport.verification_result);
            }
            else {
                verificationResult = docImport.verification_result;
            }
        }
        catch {
            verificationResult = docImport.verification_result;
        }
        res.json({ data: verificationResult, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=pdfImport.js.map