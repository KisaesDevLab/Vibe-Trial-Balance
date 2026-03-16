import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { parse } from 'fast-csv';
import { Readable } from 'stream';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const btCollectionRouter = Router({ mergeParams: true });
export const btRulesRouter = Router({ mergeParams: true });
btCollectionRouter.use(authMiddleware);
btRulesRouter.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const anthropic = new Anthropic();

// GET /api/v1/clients/:clientId/bank-transactions
btCollectionRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  try {
    let query = db('bank_transactions as bt')
      .where('bt.client_id', clientId)
      .leftJoin('chart_of_accounts as coa', 'bt.account_id', 'coa.id')
      .leftJoin('chart_of_accounts as ai_coa', 'bt.ai_suggested_account_id', 'ai_coa.id')
      .select(
        'bt.*',
        'coa.account_name',
        'coa.account_number',
        db.raw('ai_coa.account_name as ai_suggested_account_name'),
        db.raw('ai_coa.account_number as ai_suggested_account_number'),
      )
      .orderBy([{ column: 'bt.transaction_date', order: 'desc' }, { column: 'bt.id', order: 'desc' }]);

    if (req.query.periodId) {
      query = query.where('bt.period_id', Number(req.query.periodId));
    }
    if (req.query.status) {
      query = query.where('bt.classification_status', String(req.query.status));
    }

    const rows = await query;
    res.json({ data: rows, error: null, meta: { count: rows.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/clients/:clientId/bank-transactions (manual entry)
const txSchema = z.object({
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional(),
  amount: z.number().int(),
  checkNumber: z.string().max(20).optional(),
  periodId: z.number().int().positive().optional(),
});

btCollectionRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
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
  const { transactionDate, description, amount, checkNumber, periodId } = result.data;
  try {
    const [row] = await db('bank_transactions').insert({
      client_id: clientId,
      period_id: periodId ?? null,
      transaction_date: transactionDate,
      description: description ?? null,
      amount,
      check_number: checkNumber ?? null,
      classification_status: 'unclassified',
    }).returning('*');
    res.status(201).json({ data: row, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ---- Flexible date parser ----
// Handles YYYY-MM-DD, M/D/YYYY, MM/DD/YYYY, M/D/YY, M-D-YYYY variants
function parseFlexDate(val: string): string | null {
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slash = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (slash) {
    const [, m, d, y] = slash;
    const year = y.length === 2 ? (Number(y) >= 50 ? `19${y}` : `20${y}`) : y.padStart(4, '20');
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

// ---- OFX/QFX/QBO parser (handles both SGML 1.x and XML 2.x) ----

interface ParsedTx {
  transaction_date: string;
  description: string | null;
  amount: number; // cents
  check_number: string | null;
}

function ofxTagXml(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(block);
  return m ? m[1].trim() : null;
}

function ofxTagSgml(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^\r\n<]*)`, 'i').exec(block);
  return m ? m[1].trim() : null;
}

function ofxDate(raw: string): string | null {
  // Formats: YYYYMMDD, YYYYMMDDHHMMSS, YYYYMMDDHHMMSS.XXX[+NN:NN]
  const d = raw.replace(/[.\[+\-\s].*$/, '').trim();
  if (d.length >= 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return null;
}

function parseOfx(content: string): ParsedTx[] {
  const results: ParsedTx[] = [];
  const isXml = /<\/STMTTRN>/i.test(content);

  if (isXml) {
    const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(content)) !== null) {
      const b = m[1];
      const date = ofxTagXml(b, 'DTPOSTED');
      const amt = ofxTagXml(b, 'TRNAMT');
      const name = ofxTagXml(b, 'NAME') ?? ofxTagXml(b, 'MEMO');
      const check = ofxTagXml(b, 'CHECKNUM');
      if (!date || !amt) continue;
      const parsedDate = ofxDate(date);
      const parsedAmt = parseFloat(amt);
      if (!parsedDate || isNaN(parsedAmt)) continue;
      results.push({ transaction_date: parsedDate, description: name || null, amount: Math.round(parsedAmt * 100), check_number: check || null });
    }
  } else {
    const blocks = content.split(/<STMTTRN>/i).slice(1);
    for (const block of blocks) {
      const b = block.split(/<\/STMTTRNLIST>|<\/BANKTRANLIST>/i)[0];
      const date = ofxTagSgml(b, 'DTPOSTED');
      const amt = ofxTagSgml(b, 'TRNAMT');
      const name = ofxTagSgml(b, 'NAME') ?? ofxTagSgml(b, 'MEMO');
      const check = ofxTagSgml(b, 'CHECKNUM');
      if (!date || !amt) continue;
      const parsedDate = ofxDate(date);
      const parsedAmt = parseFloat(amt);
      if (!parsedDate || isNaN(parsedAmt)) continue;
      results.push({ transaction_date: parsedDate, description: name || null, amount: Math.round(parsedAmt * 100), check_number: check || null });
    }
  }
  return results;
}

// POST /api/v1/clients/:clientId/bank-transactions/import (CSV / OFX / QFX / QBO)
btCollectionRouter.post('/import', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
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

  interface TxRow {
    transaction_date: string;
    description: string | null;
    amount: number;
    check_number: string | null;
    client_id: number;
    period_id: number | null;
    classification_status: string;
  }

  try {
    const rows: TxRow[] = [];
    const filename = (req.file.originalname ?? '').toLowerCase();
    const isOfx = /\.(ofx|qfx|qbo)$/.test(filename);

    if (isOfx) {
      const content = req.file.buffer.toString('utf8');
      const parsed = parseOfx(content);
      for (const p of parsed) {
        rows.push({ client_id: clientId, period_id: periodId, classification_status: 'unclassified', ...p });
      }
    } else {
      // Column mapping — explicit mapping from request body, or fall back to auto-detect
      const dateCol: string = req.body.dateCol ?? '';
      const descCol: string = req.body.descCol ?? '';
      const amountCol: string = req.body.amountCol ?? '';
      const debitCol: string = req.body.debitCol ?? '';
      const creditCol: string = req.body.creditCol ?? '';
      const checkCol: string = req.body.checkCol ?? '';

      const pick = (row: Record<string, string>, explicit: string, fallbacks: string[]): string => {
        if (explicit && row[explicit] !== undefined) return row[explicit];
        for (const f of fallbacks) if (row[f] !== undefined) return row[f];
        return '';
      };

      await new Promise<void>((resolve, reject) => {
        const stream = Readable.from(req.file!.buffer);
        stream
          .pipe(parse({ headers: true, trim: true, ignoreEmpty: true }))
          .on('data', (row: Record<string, string>) => {
            const dateRaw = pick(row, dateCol, ['Date', 'date', 'Transaction Date', 'transaction_date']);
            const descRaw = pick(row, descCol, ['Description', 'description', 'Memo', 'memo', 'Payee', 'payee']);
            const checkRaw = pick(row, checkCol, ['Check', 'check', 'Check Number', 'check_number']);

            if (!dateRaw) return;

            const transaction_date = parseFlexDate(dateRaw);
            if (!transaction_date) return;

            // Amount: explicit signed column, or debit/credit split, or auto-detect
            let amtDollars: number;
            if (amountCol && row[amountCol] !== undefined) {
              amtDollars = parseFloat(row[amountCol].replace(/[^0-9.\-]/g, ''));
            } else if (debitCol || creditCol) {
              const dr = debitCol ? parseFloat((row[debitCol] ?? '0').replace(/[^0-9.\-]/g, '')) || 0 : 0;
              const cr = creditCol ? parseFloat((row[creditCol] ?? '0').replace(/[^0-9.\-]/g, '')) || 0 : 0;
              amtDollars = dr - cr;
            } else {
              const raw = pick(row, '', ['Amount', 'amount', 'Debit', 'debit']);
              amtDollars = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
            }

            if (isNaN(amtDollars)) return;

            rows.push({
              client_id: clientId,
              period_id: periodId,
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
      res.status(400).json({ data: null, error: { code: 'EMPTY_FILE', message: 'No valid rows found in CSV' } });
      return;
    }

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      await db('bank_transactions').insert(rows.slice(i, i + chunkSize));
    }

    res.json({ data: { imported: rows.length }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/clients/:clientId/bank-transactions/ai-classify
const aiClassifySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
});

btCollectionRouter.post('/ai-classify', async (req: AuthRequest, res: Response): Promise<void> => {
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
    const transactions = await db('bank_transactions')
      .where({ client_id: clientId })
      .whereIn('id', result.data.ids)
      .select('id', 'description', 'amount', 'transaction_date');

    if (transactions.length === 0) {
      res.json({ data: { classified: 0, results: [] }, error: null });
      return;
    }

    const accounts = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('id', 'account_number', 'account_name', 'category')
      .orderBy('account_number');

    const rules = await db('classification_rules as r')
      .join('chart_of_accounts as c', 'r.account_id', 'c.id')
      .where('r.client_id', clientId)
      .select('r.payee_pattern', 'c.account_number', 'c.account_name', 'r.times_confirmed')
      .orderBy('r.times_confirmed', 'desc')
      .limit(50);

    interface AccountRow { id: number; account_number: string; account_name: string; category: string; }
    interface RuleRow { payee_pattern: string; account_number: string; account_name: string; }
    interface TxRow { id: number; description: string | null; amount: number; transaction_date: string; }

    const coaList = (accounts as AccountRow[]).map((a) =>
      `ID:${a.id} | ${a.account_number} - ${a.account_name} (${a.category})`
    ).join('\n');

    const rulesList = rules.length > 0
      ? (rules as RuleRow[]).map((r) => `"${r.payee_pattern}" → ${r.account_number} ${r.account_name}`).join('\n')
      : 'None yet';

    const txList = (transactions as TxRow[]).map((t) =>
      `ID:${t.id} | ${t.transaction_date} | ${t.description ?? '(no description)'} | $${(t.amount / 100).toFixed(2)}`
    ).join('\n');

    const prompt = `You are an accounting assistant. Classify the following bank transactions to the most appropriate account.

CHART OF ACCOUNTS:
${coaList}

EXISTING CLASSIFICATION RULES:
${rulesList}

TRANSACTIONS TO CLASSIFY:
${txList}

Return a JSON array only. Each element: { "id": number, "accountId": number, "confidence": 0.0-1.0, "reasoning": string }`;

    const aiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = aiMessage.content[0].type === 'text' ? aiMessage.content[0].text : '';
    // Strip any markdown code fences
    const jsonText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let suggestions: Array<{ id: number; accountId: number; confidence: number; reasoning: string }> = [];
    try {
      suggestions = JSON.parse(jsonText);
    } catch {
      res.status(500).json({ data: null, error: { code: 'AI_PARSE_ERROR', message: 'Failed to parse AI response' } });
      return;
    }

    const accountIdSet = new Set((accounts as AccountRow[]).map((a) => a.id));
    let classified = 0;
    for (const s of suggestions) {
      if (!accountIdSet.has(s.accountId)) continue;
      await db('bank_transactions')
        .where({ id: s.id, client_id: clientId })
        .update({
          ai_suggested_account_id: s.accountId,
          ai_confidence: s.confidence,
          classification_status: 'ai_suggested',
        });
      classified++;
    }

    res.json({ data: { classified, results: suggestions }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PATCH /api/v1/clients/:clientId/bank-transactions/:id
const classifySchema = z.object({
  accountId: z.number().int().positive().nullable().optional(),
  periodId: z.number().int().positive().nullable().optional(),
  classificationStatus: z.enum(['unclassified', 'ai_suggested', 'confirmed', 'manual']).optional(),
});

btCollectionRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
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

  const updates: Record<string, unknown> = {};
  if (result.data.accountId !== undefined) updates.account_id = result.data.accountId;
  if (result.data.periodId !== undefined) updates.period_id = result.data.periodId;
  if (result.data.classificationStatus !== undefined) {
    updates.classification_status = result.data.classificationStatus;
  } else if (result.data.accountId) {
    updates.classification_status = 'manual';
    updates.classified_by = req.user!.userId;
  }

  try {
    const updated = await db('bank_transactions')
      .where({ id, client_id: clientId })
      .update(updates)
      .returning('*');

    if (updated.length === 0) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
      return;
    }

    // Upsert classification rule when manually confirming
    const status = updates.classification_status as string | undefined;
    if ((status === 'confirmed' || status === 'manual') && updates.account_id && updated[0].description) {
      await db('classification_rules')
        .insert({
          client_id: clientId,
          payee_pattern: (updated[0].description as string).trim(),
          account_id: updates.account_id,
          times_confirmed: 1,
        })
        .onConflict(['client_id', 'payee_pattern'])
        .merge({
          account_id: updates.account_id,
          times_confirmed: db.raw('classification_rules.times_confirmed + 1'),
          updated_at: db.fn.now(),
        });
    }

    res.json({ data: updated[0], error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// DELETE /api/v1/clients/:clientId/bank-transactions/:id
btCollectionRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const id = Number(req.params.id);
  if (isNaN(clientId) || isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }
  try {
    const deleted = await db('bank_transactions').where({ id, client_id: clientId }).delete();
    if (deleted === 0) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
      return;
    }
    res.json({ data: { deleted }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/clients/:clientId/classification-rules
btRulesRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  try {
    const rules = await db('classification_rules as r')
      .join('chart_of_accounts as c', 'r.account_id', 'c.id')
      .where('r.client_id', clientId)
      .select('r.*', 'c.account_name', 'c.account_number')
      .orderBy('r.times_confirmed', 'desc');
    res.json({ data: rules, error: null, meta: { count: rules.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// DELETE /api/v1/clients/:clientId/classification-rules/:id
btRulesRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const id = Number(req.params.id);
  if (isNaN(clientId) || isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }
  try {
    const deleted = await db('classification_rules').where({ id, client_id: clientId }).delete();
    if (deleted === 0) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
      return;
    }
    res.json({ data: { deleted }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
