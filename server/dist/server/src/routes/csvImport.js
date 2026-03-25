"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvImportRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.csvImportRouter = (0, express_1.Router)();
exports.csvImportRouter.use(auth_1.authMiddleware);
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
async function getAnthropicClient() {
    const setting = await (0, db_1.db)('settings').where({ key: 'claude_api_key' }).first('value');
    const apiKey = setting?.value ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error('Claude API key not configured');
    return new sdk_1.default({ apiKey });
}
// ── Amount parsing helpers ───────────────────────────────────────────────────
function parseAmountToCents(raw) {
    if (!raw || raw.trim() === '' || raw.trim() === '-')
        return 0;
    let s = raw.trim();
    // Handle parentheses negatives: (1,234.56) → -1234.56
    const isNeg = s.startsWith('(') && s.endsWith(')');
    if (isNeg)
        s = '-' + s.slice(1, -1);
    // Strip currency symbols and commas
    s = s.replace(/[$,\s]/g, '');
    const n = parseFloat(s);
    if (isNaN(n))
        return 0;
    return Math.round(n * 100);
}
// ── Fallback column detection (no AI) ───────────────────────────────────────
function detectDelimiter(lines) {
    const sample = lines.slice(0, 5).join('\n');
    const commas = (sample.match(/,/g) || []).length;
    const tabs = (sample.match(/\t/g) || []).length;
    const semicolons = (sample.match(/;/g) || []).length;
    if (tabs >= commas && tabs >= semicolons)
        return '\t';
    if (semicolons > commas)
        return ';';
    return ',';
}
function splitCsvRow(line, delimiter) {
    // Simple CSV split respecting quoted fields
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (ch === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        }
        else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}
function buildFallbackResult(lines, rawCsv) {
    const delimiter = detectDelimiter(lines);
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) {
        return {
            delimiter,
            hasHeaders: false,
            headerRow: 0,
            dataStartRow: 0,
            amountFormat: 'separate_dr_cr',
            columns: { accountNumber: null, accountName: null, debit: null, credit: null, amount: null },
            rowsToSkip: [],
            matches: [],
        };
    }
    const firstRow = splitCsvRow(nonEmpty[0], delimiter);
    const colCount = firstRow.length;
    // Heuristic: if first row looks like headers (contains text, not numbers)
    const looksLikeHeader = firstRow.some((c) => {
        const lower = c.toLowerCase();
        return lower.includes('account') || lower.includes('debit') || lower.includes('credit') || lower.includes('amount') || lower.includes('balance');
    });
    let accountNumberCol = null;
    let accountNameCol = null;
    let debitCol = null;
    let creditCol = null;
    let amountCol = null;
    if (looksLikeHeader) {
        firstRow.forEach((h, i) => {
            const lower = h.toLowerCase();
            if ((lower.includes('account') && lower.includes('number')) || lower === 'acct #' || lower === 'acct#' || lower === 'no.' || lower === 'number')
                accountNumberCol = i;
            else if (lower.includes('account') || lower === 'name' || lower === 'description')
                accountNameCol = i;
            else if (lower.includes('debit') || lower === 'dr')
                debitCol = i;
            else if (lower.includes('credit') || lower === 'cr')
                creditCol = i;
            else if (lower.includes('amount') || lower.includes('balance'))
                amountCol = i;
        });
    }
    // Defaults if detection failed
    if (accountNumberCol === null && colCount >= 1)
        accountNumberCol = 0;
    if (accountNameCol === null && colCount >= 2)
        accountNameCol = 1;
    const amountFormat = debitCol !== null && creditCol !== null ? 'separate_dr_cr' :
        amountCol !== null ? 'single_signed' : 'separate_dr_cr';
    const dataStartRow = looksLikeHeader ? 1 : 0;
    // Build basic matches
    const allLines = rawCsv.split('\n');
    const matches = [];
    for (let i = dataStartRow; i < Math.min(allLines.length, 30); i++) {
        const line = allLines[i];
        if (!line.trim())
            continue;
        const cells = splitCsvRow(line, delimiter);
        const csvAccountNumber = accountNumberCol !== null ? (cells[accountNumberCol] ?? null) : null;
        const csvAccountName = accountNameCol !== null ? (cells[accountNameCol] ?? null) : null;
        let debitCents = 0;
        let creditCents = 0;
        if (amountFormat === 'separate_dr_cr') {
            debitCents = debitCol !== null ? parseAmountToCents(cells[debitCol]) : 0;
            creditCents = creditCol !== null ? parseAmountToCents(cells[creditCol]) : 0;
        }
        else {
            const raw = amountCol !== null ? (cells[amountCol] ?? '') : '';
            const amt = parseAmountToCents(raw);
            if (amt >= 0)
                debitCents = amt;
            else
                creditCents = Math.abs(amt);
        }
        matches.push({
            csvRow: i,
            csvAccountNumber,
            csvAccountName,
            csvDebit: debitCol !== null ? (cells[debitCol] ?? null) : null,
            csvCredit: creditCol !== null ? (cells[creditCol] ?? null) : null,
            matchedAccountId: null,
            matchedAccountNumber: null,
            matchedAccountName: null,
            confidence: 0,
            matchType: 'none',
            action: 'create_new',
            debitCents,
            creditCents,
        });
    }
    return {
        delimiter,
        hasHeaders: looksLikeHeader,
        headerRow: looksLikeHeader ? 0 : -1,
        dataStartRow,
        amountFormat,
        columns: { accountNumber: accountNumberCol, accountName: accountNameCol, debit: debitCol, credit: creditCol, amount: amountCol },
        rowsToSkip: [],
        matches,
    };
}
// ── POST /api/v1/import/csv/analyze ─────────────────────────────────────────
exports.csvImportRouter.post('/analyze', upload.single('file'), async (req, res) => {
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
        // Read file content
        const rawCsv = req.file.buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const allLines = rawCsv.split('\n');
        const first30Lines = allLines.slice(0, 30);
        // Load client COA
        const coa = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .select('id', 'account_number', 'account_name', 'category', 'normal_balance')
            .orderBy('account_number');
        const coaSummary = coa.map((a) => `${a.id}|${a.account_number}|${a.account_name}|${a.category}|${a.normal_balance}`).join('\n');
        const prompt = `You are an expert accountant analyzing a CSV trial balance file.

Here are the first 30 rows of the CSV:
\`\`\`
${first30Lines.join('\n')}
\`\`\`

Here is the client's chart of accounts (format: id|account_number|account_name|category|normal_balance):
\`\`\`
${coaSummary || '(no accounts yet)'}
\`\`\`

Analyze the CSV and return ONLY a valid JSON object (no prose, no markdown, no code fences) with this exact structure:
{
  "delimiter": ",",
  "hasHeaders": true,
  "headerRow": 0,
  "dataStartRow": 1,
  "amountFormat": "separate_dr_cr",
  "columns": {
    "accountNumber": 0,
    "accountName": 1,
    "debit": 2,
    "credit": 3,
    "amount": null
  },
  "rowsToSkip": [],
  "matches": [
    {
      "csvRow": 1,
      "csvAccountNumber": "1000",
      "csvAccountName": "Cash",
      "csvDebit": "15000.00",
      "csvCredit": "0.00",
      "matchedAccountId": 42,
      "matchedAccountNumber": "1000",
      "matchedAccountName": "Cash - Operating",
      "confidence": 0.95,
      "matchType": "exact",
      "action": "match",
      "debitCents": 1500000,
      "creditCents": 0
    }
  ]
}

Rules:
- amountFormat: "separate_dr_cr" if debit and credit columns exist separately, "single_signed" if one amount column (negative = credit), "single_parentheses" if one amount column with parentheses for negatives
- For each data row (skip headers, subtotals, blank rows, total rows), produce one match object
- matchedAccountId: use the id from the COA if confident match, else null
- confidence: 0-1 where 1=exact account number match, 0.8=same number different name, 0.7=fuzzy name match, 0=no match
- matchType: "exact" (same account number), "fuzzy" (name/partial match), "none" (no match)
- action: "match" if matched, "create_new" if no match but looks like a real account, "skip" if subtotal/header/blank
- debitCents and creditCents: the parsed amounts in integer cents (multiply dollars by 100, round to nearest cent)
- For parentheses negatives like (1,234.56): treat as credit amount 123456 cents
- rowsToSkip: row indexes (0-based from start of file) of total/subtotal/header rows that should be ignored
- Include ALL data rows up to row 30 in matches (including rows where action="skip")`;
        let analysisResult;
        let fallbackMode = false;
        try {
            const anthropic = await getAnthropicClient();
            const aiMessage = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
            });
            const raw = aiMessage.content[0].text.trim();
            // Extract JSON object
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error('AI returned invalid format');
            analysisResult = JSON.parse(jsonMatch[0]);
        }
        catch (_aiErr) {
            // Fallback: use heuristic column detection
            fallbackMode = true;
            analysisResult = buildFallbackResult(allLines, rawCsv);
        }
        res.json({
            data: {
                ...analysisResult,
                fallbackMode,
                totalRows: allLines.filter((l) => l.trim()).length,
                rawPreview: first30Lines,
            },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// ── POST /api/v1/import/csv/confirm ─────────────────────────────────────────
exports.csvImportRouter.post('/confirm', async (req, res) => {
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
                if (!match.csvAccountName) {
                    rowsSkipped++;
                    continue;
                }
                // Determine category and normal_balance based on common patterns
                const name = (match.csvAccountName || '').toLowerCase();
                const num = (match.csvAccountNumber || '').trim();
                let category = 'expenses';
                let normalBalance = 'debit';
                // Basic heuristics based on account number ranges
                const numericPart = parseInt(num.replace(/\D/g, ''), 10);
                if (!isNaN(numericPart)) {
                    if (numericPart < 2000) {
                        category = 'assets';
                        normalBalance = 'debit';
                    }
                    else if (numericPart < 3000) {
                        category = 'liabilities';
                        normalBalance = 'credit';
                    }
                    else if (numericPart < 4000) {
                        category = 'equity';
                        normalBalance = 'credit';
                    }
                    else if (numericPart < 5000) {
                        category = 'revenue';
                        normalBalance = 'credit';
                    }
                    else {
                        category = 'expenses';
                        normalBalance = 'debit';
                    }
                }
                else {
                    // Text heuristics
                    if (name.includes('cash') || name.includes('receivable') || name.includes('asset') || name.includes('equipment') || name.includes('inventory')) {
                        category = 'assets';
                        normalBalance = 'debit';
                    }
                    else if (name.includes('payable') || name.includes('liability') || name.includes('loan') || name.includes('debt')) {
                        category = 'liabilities';
                        normalBalance = 'credit';
                    }
                    else if (name.includes('equity') || name.includes('capital') || name.includes('retained')) {
                        category = 'equity';
                        normalBalance = 'credit';
                    }
                    else if (name.includes('revenue') || name.includes('income') || name.includes('sales')) {
                        category = 'revenue';
                        normalBalance = 'credit';
                    }
                }
                try {
                    const [newAccount] = await (0, db_1.db)('chart_of_accounts')
                        .insert({
                        client_id: clientId,
                        account_number: match.csvAccountNumber || `IMPORT-${Date.now()}`,
                        account_name: match.csvAccountName,
                        category,
                        normal_balance: normalBalance,
                        is_active: true,
                    })
                        .returning('id');
                    accountId = newAccount.id;
                    accountsCreated++;
                }
                catch (_insertErr) {
                    // Account might already exist — try to find it
                    const existing = await (0, db_1.db)('chart_of_accounts')
                        .where({ client_id: clientId, account_number: match.csvAccountNumber })
                        .first('id');
                    if (existing) {
                        accountId = existing.id;
                    }
                    else {
                        rowsSkipped++;
                        continue;
                    }
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
            import_type: 'csv',
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
//# sourceMappingURL=csvImport.js.map