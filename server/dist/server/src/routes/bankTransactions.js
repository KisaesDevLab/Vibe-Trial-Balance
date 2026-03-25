"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.btRulesRouter = exports.btCollectionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const fast_csv_1 = require("fast-csv");
const stream_1 = require("stream");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const crypto_1 = require("crypto");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const periodGuard_1 = require("../lib/periodGuard");
function txHash(date, description, amount) {
    return (0, crypto_1.createHash)('sha256').update(`${date}|${description}|${amount}`).digest('hex').slice(0, 64);
}
// ---- Journal entry sync helper ----
// Creates, replaces, or deletes the auto-generated book JE for a bank transaction.
// A JE is created when the transaction has account_id + source_account_id + period_id.
// Sign convention: amount > 0 → DR source, CR classification
//                  amount < 0 → DR classification, CR source (abs amount)
async function syncTxJE(trx, txId, clientId, userId) {
    const tx = await trx('bank_transactions').where({ id: txId, client_id: clientId }).first();
    if (!tx)
        return;
    // Delete any existing auto-generated JE
    if (tx.journal_entry_id) {
        await trx('journal_entry_lines').where({ journal_entry_id: tx.journal_entry_id }).delete();
        await trx('journal_entries').where({ id: tx.journal_entry_id }).delete();
        await trx('bank_transactions').where({ id: txId }).update({ journal_entry_id: null });
    }
    // Need all three fields to create a JE
    if (!tx.account_id || !tx.source_account_id || !tx.period_id || tx.amount === 0)
        return;
    const absAmount = Math.abs(Number(tx.amount));
    const debitAccountId = tx.amount > 0 ? tx.source_account_id : tx.account_id;
    const creditAccountId = tx.amount > 0 ? tx.account_id : tx.source_account_id;
    const lastEntry = await trx('journal_entries')
        .where({ period_id: tx.period_id, entry_type: 'trans' })
        .max('entry_number as max')
        .first();
    const entryNumber = (lastEntry?.max ?? 0) + 1;
    const [je] = await trx('journal_entries').insert({
        period_id: tx.period_id,
        entry_number: entryNumber,
        entry_type: 'trans',
        entry_date: tx.transaction_date,
        description: tx.description ?? `Bank transaction ${tx.transaction_date}`,
        is_recurring: false,
        created_by: userId,
    }).returning('*');
    await trx('journal_entry_lines').insert([
        { journal_entry_id: je.id, account_id: debitAccountId, debit: absAmount, credit: 0 },
        { journal_entry_id: je.id, account_id: creditAccountId, debit: 0, credit: absAmount },
    ]);
    await trx('bank_transactions').where({ id: txId }).update({ journal_entry_id: je.id });
}
exports.btCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.btRulesRouter = (0, express_1.Router)({ mergeParams: true });
exports.btCollectionRouter.use(auth_1.authMiddleware);
exports.btRulesRouter.use(auth_1.authMiddleware);
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
async function getAnthropicClient() {
    const setting = await (0, db_1.db)('settings').where({ key: 'claude_api_key' }).first('value');
    const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw Object.assign(new Error('Claude API key not configured. Add it in Settings.'), { code: 'NO_API_KEY' });
    return new sdk_1.default({ apiKey });
}
// GET /api/v1/clients/:clientId/bank-transactions
exports.btCollectionRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(500, Math.max(10, Number(req.query.pageSize) || 100));
        const offset = (page - 1) * pageSize;
        let countQuery = (0, db_1.db)('bank_transactions').where({ client_id: clientId });
        if (req.query.sourceAccountId) {
            countQuery = countQuery.where('source_account_id', Number(req.query.sourceAccountId));
        }
        if (req.query.periodId) {
            countQuery = countQuery.where('period_id', Number(req.query.periodId));
        }
        if (req.query.status) {
            countQuery = countQuery.where('classification_status', String(req.query.status));
        }
        if (req.query.entrySource) {
            countQuery = countQuery.where('entry_source', String(req.query.entrySource));
        }
        else if (req.query.excludeEntrySource) {
            countQuery = countQuery.whereNot('entry_source', String(req.query.excludeEntrySource));
        }
        const [{ count }] = await countQuery.count('id as count');
        const total = Number(count);
        let query = (0, db_1.db)('bank_transactions as bt')
            .where('bt.client_id', clientId)
            .leftJoin('chart_of_accounts as coa', 'bt.account_id', 'coa.id')
            .leftJoin('chart_of_accounts as ai_coa', 'bt.ai_suggested_account_id', 'ai_coa.id')
            .leftJoin('chart_of_accounts as src', 'bt.source_account_id', 'src.id')
            .select('bt.*', 'coa.account_name', 'coa.account_number', db_1.db.raw('ai_coa.account_name as ai_suggested_account_name'), db_1.db.raw('ai_coa.account_number as ai_suggested_account_number'), db_1.db.raw('src.account_name as source_account_name'), db_1.db.raw('src.account_number as source_account_number'))
            .orderBy([{ column: 'bt.transaction_date', order: 'desc' }, { column: 'bt.id', order: 'desc' }]);
        if (req.query.sourceAccountId) {
            query = query.where('bt.source_account_id', Number(req.query.sourceAccountId));
        }
        if (req.query.periodId) {
            query = query.where('bt.period_id', Number(req.query.periodId));
        }
        if (req.query.status) {
            query = query.where('bt.classification_status', String(req.query.status));
        }
        if (req.query.entrySource) {
            query = query.where('bt.entry_source', String(req.query.entrySource));
        }
        else if (req.query.excludeEntrySource) {
            query = query.whereNot('bt.entry_source', String(req.query.excludeEntrySource));
        }
        const rows = await query.limit(pageSize).offset(offset);
        res.json({ data: rows, error: null, meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/clients/:clientId/bank-transactions (manual entry)
const txSchema = zod_1.z.object({
    transactionDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: zod_1.z.string().max(500).optional(),
    amount: zod_1.z.number().int(),
    checkNumber: zod_1.z.string().max(20).optional(),
    periodId: zod_1.z.number().int().positive().optional(),
    sourceAccountId: zod_1.z.number().int().positive().optional(),
});
exports.btCollectionRouter.post('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = txSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { transactionDate, description, amount, checkNumber, periodId, sourceAccountId } = result.data;
    try {
        const [row] = await (0, db_1.db)('bank_transactions').insert({
            client_id: clientId,
            period_id: periodId ?? null,
            source_account_id: sourceAccountId ?? null,
            transaction_date: transactionDate,
            description: description ?? null,
            amount,
            check_number: checkNumber ?? null,
            classification_status: 'unclassified',
        }).returning('*');
        res.status(201).json({ data: row, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// ---- Flexible date parser ----
// Handles YYYY-MM-DD, M/D/YYYY, MM/DD/YYYY, M/D/YY, M-D-YYYY variants
function parseFlexDate(val) {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    const slash = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
    if (slash) {
        const [, m, d, y] = slash;
        const year = y.length === 2 ? (Number(y) >= 50 ? `19${y}` : `20${y}`) : y.padStart(4, '20');
        return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
}
// Extract a leaf element value from XML OFX (has closing tags on every element)
function ofxTagXml(block, tag) {
    const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i').exec(block);
    return m ? m[1].trim() : null;
}
// Extract a leaf element value from SGML OFX (no closing tags on leaf elements;
// value ends at end of line or next opening tag)
function ofxTagSgml(block, tag) {
    const m = new RegExp(`<${tag}[^>]*>[ \t]*([^\r\n<]+)`, 'i').exec(block);
    return m ? m[1].trim() : null;
}
function ofxDate(raw) {
    // Strip timezone suffix: YYYYMMDDHHMMSS.mmm[TZ:NAME] or [...] or [+HH] etc.
    const d = raw.replace(/[\[.+\-].*$/, '').replace(/\s/g, '');
    if (d.length >= 8 && /^\d{8}/.test(d)) {
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    }
    return null;
}
function parseOfx(fileBuffer) {
    // Try UTF-8 first; fall back to latin1 for Windows-1252 encoded files
    let content = fileBuffer.toString('utf8');
    if (content.includes('\uFFFD')) {
        content = fileBuffer.toString('latin1');
    }
    // Strip UTF-8 BOM if present
    content = content.replace(/^\uFEFF/, '');
    // Detect XML vs SGML:
    //   OFX 2.x XML:  leaf elements have closing tags  e.g. </DTPOSTED>
    //   OFX 1.x SGML: only aggregate elements have closing tags; leaf elements do NOT
    //   OFXHEADER:200 also signals XML; OFXHEADER:100 signals SGML
    const isXml = /OFXHEADER:\s*200/i.test(content) ||
        /^<\?xml/i.test(content.trimStart()) ||
        /<\/DTPOSTED>/i.test(content) ||
        /<\/TRNAMT>/i.test(content);
    const results = [];
    if (isXml) {
        const blockRe = /<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi;
        let m;
        while ((m = blockRe.exec(content)) !== null) {
            const b = m[1];
            const date = ofxTagXml(b, 'DTPOSTED');
            const amt = ofxTagXml(b, 'TRNAMT');
            const name = ofxTagXml(b, 'NAME') ?? ofxTagXml(b, 'MEMO') ?? ofxTagXml(b, 'PAYEE');
            const check = ofxTagXml(b, 'CHECKNUM');
            if (!date || !amt)
                continue;
            const parsedDate = ofxDate(date);
            const parsedAmt = parseFloat(amt.replace(/[^0-9.\-]/g, ''));
            if (!parsedDate || isNaN(parsedAmt))
                continue;
            results.push({
                transaction_date: parsedDate,
                description: name || null,
                amount: Math.round(parsedAmt * 100),
                check_number: check || null,
            });
        }
    }
    else {
        // SGML: aggregate elements like <STMTTRN>...</STMTTRN> have closing tags,
        // but leaf elements like <DTPOSTED> and <TRNAMT> do not.
        const blocks = content.split(/<STMTTRN[^>]*>/i).slice(1);
        for (const block of blocks) {
            // Terminate block at </STMTTRN> (present in SGML for aggregate close)
            const endIdx = block.search(/<\/STMTTRN>/i);
            const b = endIdx >= 0 ? block.slice(0, endIdx) : block;
            const date = ofxTagSgml(b, 'DTPOSTED');
            const amt = ofxTagSgml(b, 'TRNAMT');
            const name = ofxTagSgml(b, 'NAME') ?? ofxTagSgml(b, 'MEMO') ?? ofxTagSgml(b, 'PAYEE');
            const check = ofxTagSgml(b, 'CHECKNUM');
            if (!date || !amt)
                continue;
            const parsedDate = ofxDate(date);
            const parsedAmt = parseFloat(amt.replace(/[^0-9.\-]/g, ''));
            if (!parsedDate || isNaN(parsedAmt))
                continue;
            results.push({
                transaction_date: parsedDate,
                description: name || null,
                amount: Math.round(parsedAmt * 100),
                check_number: check || null,
            });
        }
    }
    return results;
}
// POST /api/v1/clients/:clientId/bank-transactions/import (CSV / OFX / QFX / QBO)
exports.btCollectionRouter.post('/import', upload.single('file'), async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    if (!req.file) {
        res.status(400).json({ data: null, error: { code: 'NO_FILE', message: 'No file uploaded' } });
        return;
    }
    const periodId = req.body.periodId ? Number(req.body.periodId) : null;
    const sourceAccountId = req.body.sourceAccountId ? Number(req.body.sourceAccountId) : null;
    try {
        const rows = [];
        const filename = (req.file.originalname ?? '').toLowerCase();
        const isOfx = /\.(ofx|qfx|qbo)$/.test(filename);
        if (isOfx) {
            const parsed = parseOfx(req.file.buffer);
            for (const p of parsed) {
                rows.push({ client_id: clientId, period_id: periodId, source_account_id: sourceAccountId, classification_status: 'unclassified', ...p });
            }
        }
        else {
            // Column mapping — explicit mapping from request body, or fall back to auto-detect
            const dateCol = req.body.dateCol ?? '';
            const descCol = req.body.descCol ?? '';
            const amountCol = req.body.amountCol ?? '';
            const debitCol = req.body.debitCol ?? '';
            const creditCol = req.body.creditCol ?? '';
            const checkCol = req.body.checkCol ?? '';
            const pick = (row, explicit, fallbacks) => {
                if (explicit && row[explicit] !== undefined)
                    return row[explicit];
                for (const f of fallbacks)
                    if (row[f] !== undefined)
                        return row[f];
                return '';
            };
            await new Promise((resolve, reject) => {
                const stream = stream_1.Readable.from(req.file.buffer);
                stream
                    .pipe((0, fast_csv_1.parse)({ headers: true, trim: true, ignoreEmpty: true }))
                    .on('data', (row) => {
                    const dateRaw = pick(row, dateCol, ['Date', 'date', 'Transaction Date', 'transaction_date']);
                    const descRaw = pick(row, descCol, ['Description', 'description', 'Memo', 'memo', 'Payee', 'payee']);
                    const checkRaw = pick(row, checkCol, ['Check', 'check', 'Check Number', 'check_number']);
                    if (!dateRaw)
                        return;
                    const transaction_date = parseFlexDate(dateRaw);
                    if (!transaction_date)
                        return;
                    // Amount: explicit signed column, or debit/credit split, or auto-detect
                    let amtDollars;
                    if (amountCol && row[amountCol] !== undefined) {
                        amtDollars = parseFloat(row[amountCol].replace(/[^0-9.\-]/g, ''));
                    }
                    else if (debitCol || creditCol) {
                        const dr = debitCol ? parseFloat((row[debitCol] ?? '0').replace(/[^0-9.\-]/g, '')) || 0 : 0;
                        const cr = creditCol ? parseFloat((row[creditCol] ?? '0').replace(/[^0-9.\-]/g, '')) || 0 : 0;
                        amtDollars = dr - cr;
                    }
                    else {
                        const raw = pick(row, '', ['Amount', 'amount', 'Debit', 'debit']);
                        amtDollars = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
                    }
                    if (isNaN(amtDollars))
                        return;
                    rows.push({
                        client_id: clientId,
                        period_id: periodId,
                        source_account_id: sourceAccountId,
                        transaction_date,
                        description: descRaw.trim() || null,
                        amount: Math.round(amtDollars * 100),
                        check_number: checkRaw.trim() || null,
                        classification_status: 'unclassified',
                    });
                })
                    .on('end', resolve)
                    .on('error', reject);
            });
        }
        if (rows.length === 0) {
            const hint = isOfx
                ? 'No STMTTRN blocks found. Verify the file is a valid OFX/QFX/QBO export and contains transaction data.'
                : 'No valid rows found. Check that the file has a header row with Date and Amount columns.';
            res.status(400).json({ data: null, error: { code: 'EMPTY_FILE', message: hint } });
            return;
        }
        let importedCount = 0;
        let duplicateCount = 0;
        for (const row of rows) {
            const hash = txHash(row.transaction_date, row.description ?? '', row.amount);
            const existing = await (0, db_1.db)('bank_transactions').where({ client_id: clientId, import_hash: hash }).first('id');
            if (existing) {
                duplicateCount++;
                continue;
            }
            await (0, db_1.db)('bank_transactions').insert({ ...row, import_hash: hash });
            importedCount++;
        }
        res.json({ data: { imported: importedCount, duplicates: duplicateCount }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/clients/:clientId/bank-transactions/manual
const manualBatchSchema = zod_1.z.object({
    periodId: zod_1.z.number().int().positive().optional(),
    sourceAccountId: zod_1.z.number().int().positive().optional(), // batch-level fallback
    transactions: zod_1.z.array(zod_1.z.object({
        transactionDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: zod_1.z.string().max(500).min(1),
        amount: zod_1.z.number().int().refine((v) => v !== 0, { message: 'Amount must be non-zero' }),
        checkNumber: zod_1.z.string().max(20).optional(),
        accountId: zod_1.z.number().int().positive(),
        sourceAccountId: zod_1.z.number().int().positive().optional(), // per-transaction (overrides batch)
        createRule: zod_1.z.boolean().optional(),
    })).min(1),
});
exports.btCollectionRouter.post('/manual', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = manualBatchSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { periodId, sourceAccountId, transactions } = result.data;
    try {
        let createdIds = [];
        let rulesUpdated = 0;
        await db_1.db.transaction(async (trx) => {
            const inserted = [];
            for (const tx of transactions) {
                const [row] = await trx('bank_transactions').insert({
                    client_id: clientId,
                    period_id: periodId ?? null,
                    source_account_id: tx.sourceAccountId ?? sourceAccountId ?? null,
                    transaction_date: tx.transactionDate,
                    description: tx.description,
                    amount: tx.amount,
                    check_number: tx.checkNumber ?? null,
                    account_id: tx.accountId,
                    classification_status: 'manual',
                    entry_source: 'manual',
                    classified_by: req.user.userId,
                }).returning('id');
                inserted.push(row);
                // Sync journal entry
                await syncTxJE(trx, row.id, clientId, req.user.userId);
                // Create or reinforce classification rule
                if (tx.createRule !== false) {
                    const existing = await trx('classification_rules')
                        .where({ client_id: clientId, payee_pattern: tx.description.trim() })
                        .first();
                    await trx('classification_rules')
                        .insert({
                        client_id: clientId,
                        payee_pattern: tx.description.trim(),
                        account_id: tx.accountId,
                        times_confirmed: 1,
                    })
                        .onConflict(['client_id', 'payee_pattern'])
                        .merge({
                        account_id: tx.accountId,
                        times_confirmed: db_1.db.raw('classification_rules.times_confirmed + 1'),
                        updated_at: db_1.db.fn.now(),
                    });
                    if (!existing)
                        rulesUpdated++;
                    else
                        rulesUpdated++;
                }
            }
            createdIds = inserted.map((r) => r.id);
        });
        res.status(201).json({
            data: { created: createdIds.length, ids: createdIds, rulesUpdated },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/clients/:clientId/bank-transactions/batch-delete
const batchIdsSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.number().int().positive()).min(1),
});
exports.btCollectionRouter.post('/batch-delete', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = batchIdsSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        await db_1.db.transaction(async (trx) => {
            const txs = await trx('bank_transactions')
                .where({ client_id: clientId })
                .whereIn('id', result.data.ids)
                .select('id', 'journal_entry_id');
            const jeIds = txs.map((t) => t.journal_entry_id).filter(Boolean);
            if (jeIds.length > 0) {
                await trx('journal_entry_lines').whereIn('journal_entry_id', jeIds).delete();
                await trx('journal_entries').whereIn('id', jeIds).delete();
            }
            await trx('bank_transactions').where({ client_id: clientId }).whereIn('id', result.data.ids).delete();
        });
        res.json({ data: { deleted: result.data.ids.length }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/clients/:clientId/bank-transactions/batch-classify
const batchClassifySchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.number().int().positive()).min(1),
    accountId: zod_1.z.number().int().positive(),
});
exports.btCollectionRouter.post('/batch-classify', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = batchClassifySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { ids, accountId } = result.data;
    try {
        await db_1.db.transaction(async (trx) => {
            await trx('bank_transactions')
                .where({ client_id: clientId })
                .whereIn('id', ids)
                .update({ account_id: accountId, classification_status: 'manual', classified_by: req.user.userId });
            // Upsert classification rules for transactions that have a description
            const txsWithDesc = await trx('bank_transactions')
                .where({ client_id: clientId })
                .whereIn('id', ids)
                .whereNotNull('description')
                .select('id', 'description');
            for (const tx of txsWithDesc) {
                const pattern = tx.description.trim();
                if (!pattern)
                    continue;
                await trx('classification_rules')
                    .insert({ client_id: clientId, payee_pattern: pattern, account_id: accountId, times_confirmed: 1 })
                    .onConflict(['client_id', 'payee_pattern'])
                    .merge({ account_id: accountId, times_confirmed: db_1.db.raw('classification_rules.times_confirmed + 1'), updated_at: db_1.db.fn.now() });
            }
            // Sync JE for ALL classified transactions (not just those with descriptions)
            for (const id of ids) {
                await syncTxJE(trx, id, clientId, req.user.userId);
            }
        });
        res.json({ data: { updated: ids.length }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/clients/:clientId/bank-transactions/batch-update-source
const batchUpdateSourceSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.number().int().positive()).min(1),
    sourceAccountId: zod_1.z.number().int().positive().nullable(),
});
exports.btCollectionRouter.post('/batch-update-source', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = batchUpdateSourceSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const { ids, sourceAccountId } = result.data;
    try {
        await db_1.db.transaction(async (trx) => {
            await trx('bank_transactions')
                .where({ client_id: clientId })
                .whereIn('id', ids)
                .update({ source_account_id: sourceAccountId });
            // Re-sync JEs for any transactions that already have a classification
            const classified = await trx('bank_transactions')
                .where({ client_id: clientId })
                .whereIn('id', ids)
                .whereNotNull('account_id')
                .select('id');
            for (const tx of classified) {
                await syncTxJE(trx, tx.id, clientId, req.user.userId);
            }
        });
        res.json({ data: { updated: ids.length }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/clients/:clientId/bank-transactions/ai-classify
const aiClassifySchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.number().int().positive()).min(1).max(100),
});
exports.btCollectionRouter.post('/ai-classify', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    const result = aiClassifySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        // Skip transactions already confirmed or manually classified — don't overwrite human decisions
        const transactions = await (0, db_1.db)('bank_transactions')
            .where({ client_id: clientId })
            .whereIn('id', result.data.ids)
            .whereNotIn('classification_status', ['confirmed', 'manual'])
            .select('id', 'description', 'amount', 'transaction_date');
        if (transactions.length === 0) {
            res.json({ data: { classified: 0, results: [] }, error: null });
            return;
        }
        const accounts = await (0, db_1.db)('chart_of_accounts')
            .where({ client_id: clientId, is_active: true })
            .select('id', 'account_number', 'account_name', 'category')
            .orderBy('account_number');
        const rules = await (0, db_1.db)('classification_rules as r')
            .join('chart_of_accounts as c', 'r.account_id', 'c.id')
            .where('r.client_id', clientId)
            .select('r.payee_pattern', 'c.account_number', 'c.account_name', 'r.times_confirmed')
            .orderBy('r.times_confirmed', 'desc')
            .limit(50);
        const coaList = accounts.map((a) => `ID:${a.id} | ${a.account_number} - ${a.account_name} (${a.category})`).join('\n');
        const rulesList = rules.length > 0
            ? rules.map((r) => `"${r.payee_pattern}" → ${r.account_number} ${r.account_name}`).join('\n')
            : 'None yet';
        // Format amount with explicit debit/credit label so the model understands sign convention
        const txList = transactions.map((t) => {
            const cents = Number(t.amount);
            const dollars = Math.abs(cents) / 100;
            const flow = cents >= 0 ? 'CREDIT' : 'DEBIT';
            return `ID:${t.id} | ${t.transaction_date} | ${t.description ?? '(no description)'} | ${flow} $${dollars.toFixed(2)}`;
        }).join('\n');
        const prompt = `You are an accounting assistant. Classify each bank transaction to the single most appropriate GL account.

Sign convention: CREDIT = money into the bank account (positive amount), DEBIT = money out (negative amount).

CHART OF ACCOUNTS:
${coaList}

EXISTING CLASSIFICATION RULES (use these as strong hints):
${rulesList}

TRANSACTIONS TO CLASSIFY:
${txList}

Respond with a JSON array and nothing else. Each element: { "id": number, "accountId": number, "confidence": 0.0-1.0, "reasoning": string }`;
        const anthropic = await getAnthropicClient();
        const aiMessage = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8192,
            stop_sequences: ['\n\n\n'],
            messages: [{ role: 'user', content: prompt }],
        });
        const responseText = aiMessage.content[0].type === 'text' ? aiMessage.content[0].text : '';
        // Extract the JSON array robustly — find the outermost [...] regardless of surrounding text
        const arrayMatch = responseText.match(/\[[\s\S]*\]/);
        if (!arrayMatch) {
            res.status(500).json({ data: null, error: { code: 'AI_PARSE_ERROR', message: 'AI response did not contain a JSON array' } });
            return;
        }
        let suggestions = [];
        try {
            suggestions = JSON.parse(arrayMatch[0]);
        }
        catch {
            res.status(500).json({ data: null, error: { code: 'AI_PARSE_ERROR', message: 'Failed to parse AI response as JSON' } });
            return;
        }
        const accountIdSet = new Set(accounts.map((a) => a.id));
        let classified = 0;
        for (const s of suggestions) {
            if (!accountIdSet.has(s.accountId))
                continue;
            await (0, db_1.db)('bank_transactions')
                .where({ id: s.id, client_id: clientId })
                .update({
                ai_suggested_account_id: s.accountId,
                ai_confidence: Math.min(1, Math.max(0, Number(s.confidence))),
                classification_status: 'ai_suggested',
            });
            classified++;
        }
        res.json({ data: { classified, results: suggestions }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const code = err.code === 'NO_API_KEY' ? 'NO_API_KEY' : 'SERVER_ERROR';
        res.status(code === 'NO_API_KEY' ? 400 : 500).json({ data: null, error: { code, message } });
    }
});
// PATCH /api/v1/clients/:clientId/bank-transactions/:id
const classifySchema = zod_1.z.object({
    accountId: zod_1.z.number().int().positive().nullable().optional(),
    periodId: zod_1.z.number().int().positive().nullable().optional(),
    classificationStatus: zod_1.z.enum(['unclassified', 'ai_suggested', 'confirmed', 'manual']).optional(),
    description: zod_1.z.string().max(500).nullable().optional(),
    // Manual-entry editable fields
    transactionDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    amount: zod_1.z.number().int().refine((v) => v !== 0, { message: 'Amount must be non-zero' }).optional(),
    sourceAccountId: zod_1.z.number().int().positive().nullable().optional(),
    checkNumber: zod_1.z.string().max(20).nullable().optional(),
});
exports.btCollectionRouter.patch('/:id', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const id = Number(req.params.id);
    if (isNaN(clientId) || isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    const result = classifySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    const updates = {};
    if (result.data.accountId !== undefined)
        updates.account_id = result.data.accountId;
    if (result.data.periodId !== undefined)
        updates.period_id = result.data.periodId;
    if (result.data.description !== undefined)
        updates.description = result.data.description;
    if (result.data.transactionDate !== undefined)
        updates.transaction_date = result.data.transactionDate;
    if (result.data.amount !== undefined)
        updates.amount = result.data.amount;
    if (result.data.sourceAccountId !== undefined)
        updates.source_account_id = result.data.sourceAccountId;
    if (result.data.checkNumber !== undefined)
        updates.check_number = result.data.checkNumber;
    if (result.data.classificationStatus !== undefined) {
        updates.classification_status = result.data.classificationStatus;
    }
    else if (result.data.accountId) {
        updates.classification_status = 'manual';
        updates.classified_by = req.user.userId;
    }
    try {
        let finalRow;
        await db_1.db.transaction(async (trx) => {
            // Fetch existing transaction before update for reclassification audit
            const existingTx = await trx('bank_transactions').where({ id, client_id: clientId }).first();
            const updated = await trx('bank_transactions')
                .where({ id, client_id: clientId })
                .update(updates)
                .returning('*');
            if (updated.length === 0)
                throw Object.assign(new Error('NOT_FOUND'), { status: 404 });
            finalRow = updated[0];
            // Upsert classification rule when manually confirming
            const status = updates.classification_status;
            if ((status === 'confirmed' || status === 'manual') && updates.account_id && finalRow.description) {
                await trx('classification_rules')
                    .insert({
                    client_id: clientId,
                    payee_pattern: finalRow.description.trim(),
                    account_id: updates.account_id,
                    times_confirmed: 1,
                })
                    .onConflict(['client_id', 'payee_pattern'])
                    .merge({
                    account_id: updates.account_id,
                    times_confirmed: db_1.db.raw('classification_rules.times_confirmed + 1'),
                    updated_at: db_1.db.fn.now(),
                });
            }
            // Sync the auto-generated journal entry
            await syncTxJE(trx, id, clientId, req.user.userId);
            // Re-fetch after JE sync so journal_entry_id is current
            finalRow = await trx('bank_transactions').where({ id }).first();
            // If transaction had a linked JE, log the reclassification
            const newAccountId = updates.account_id;
            if (existingTx?.journal_entry_id && newAccountId && existingTx?.account_id !== newAccountId) {
                await (0, periodGuard_1.logAudit)({
                    userId: req.user.userId,
                    periodId: existingTx.period_id,
                    entityType: 'bank_transaction',
                    entityId: id,
                    action: 'reclassify',
                    description: `Bank transaction reclassified — linked JE #${existingTx.journal_entry_id} updated`,
                }, trx);
            }
        });
        res.json({ data: finalRow, error: null });
    }
    catch (err) {
        if (err instanceof Error && err.message === 'NOT_FOUND') {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/clients/:clientId/bank-transactions/:id
exports.btCollectionRouter.delete('/:id', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const id = Number(req.params.id);
    if (isNaN(clientId) || isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        await db_1.db.transaction(async (trx) => {
            const tx = await trx('bank_transactions').where({ id, client_id: clientId }).first('journal_entry_id');
            if (!tx)
                throw Object.assign(new Error('NOT_FOUND'), { status: 404 });
            if (tx.journal_entry_id) {
                await trx('journal_entry_lines').where({ journal_entry_id: tx.journal_entry_id }).delete();
                await trx('journal_entries').where({ id: tx.journal_entry_id }).delete();
            }
            await trx('bank_transactions').where({ id, client_id: clientId }).delete();
        });
        res.json({ data: { deleted: 1 }, error: null });
    }
    catch (err) {
        if (err instanceof Error && err.message === 'NOT_FOUND') {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/clients/:clientId/classification-rules
exports.btRulesRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const rules = await (0, db_1.db)('classification_rules as r')
            .join('chart_of_accounts as c', 'r.account_id', 'c.id')
            .where('r.client_id', clientId)
            .select('r.*', 'c.account_name', 'c.account_number')
            .orderBy('r.sort_order', 'asc')
            .orderBy('r.times_confirmed', 'desc');
        res.json({ data: rules, error: null, meta: { count: rules.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/clients/:clientId/classification-rules/:id
exports.btRulesRouter.delete('/:id', async (req, res) => {
    const clientId = Number(req.params.clientId);
    const id = Number(req.params.id);
    if (isNaN(clientId) || isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
        return;
    }
    try {
        const deleted = await (0, db_1.db)('classification_rules').where({ id, client_id: clientId }).delete();
        if (deleted === 0) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
            return;
        }
        res.json({ data: { deleted }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=bankTransactions.js.map