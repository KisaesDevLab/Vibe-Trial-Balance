import { Router, Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAiUsage } from '../lib/aiUsage';
import { getLLMProvider, getAiTokenSettings } from '../lib/aiClient';
import { renderPdfToImages, PdftoppmNotFoundError } from '../lib/pdfVision';
import type { LLMContentPart } from '../lib/llmProvider';
import { extractJsonObject, extractJsonArray } from '../lib/aiJsonExtract';

export const pdfImportRouter = Router();
pdfImportRouter.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Types ────────────────────────────────────────────────────────────────────

export interface PdfMatchRow {
  pdfAccountName: string;
  pdfAccountNumber: string | null;
  pdfAmount: string;
  isDebit: boolean;
  debitCents: number;
  creditCents: number;
  matchedAccountId: number | null;
  matchedAccountNumber: string | null;
  matchedAccountName: string | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'alias' | 'none';
  action: 'match' | 'create_new' | 'skip';
  category: string;
  // User-editable fields for create_new rows
  newCategory?: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  newNormalBalance?: 'debit' | 'credit';
  newAccountNumber?: string;
}

export interface PdfAnalysisResult {
  documentType: 'trial_balance' | 'pl' | 'balance_sheet';
  detectedPeriod: string | null;
  matches: PdfMatchRow[];
  warnings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAliases(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

// ── POST /api/v1/import/pdf/analyze ─────────────────────────────────────────

pdfImportRouter.post(
  '/analyze',
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
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
        const parsed = await pdfParse(req.file.buffer);
        extractedText = parsed.text ?? '';
      } catch (_parseErr) {
        res.status(400).json({ data: null, error: { code: 'PDF_PARSE_ERROR', message: 'Could not parse PDF file. Please ensure it is a valid PDF.' } });
        return;
      }

      // Detect if text-based or scanned
      const textLength = extractedText.replace(/\s/g, '').length;
      const isScanned = textLength < 100;

      // Load provider config (needed for both paths)
      const { provider, fastModel, vision } = await getLLMProvider();

      // Load client COA
      const coa = await db('chart_of_accounts')
        .where({ client_id: clientId, is_active: true })
        .select('id', 'account_number', 'account_name', 'category', 'normal_balance', 'import_aliases')
        .orderBy('account_number');

      type CoaRow = { id: number; account_number: string; account_name: string; category: string; normal_balance: string; import_aliases: unknown };
      const coaSummary = (coa as CoaRow[]).map((a) => {
        const aliases = parseAliases(a.import_aliases);
        const aliasStr = aliases.length > 0 ? aliases.join(',') : '';
        return `${a.id}|${a.account_number}|${a.account_name}|${a.category}|${a.normal_balance}|${aliasStr}`;
      }).join('\n');

      const tokenSettings = await getAiTokenSettings();
      // Use configurable chunk limit; do NOT hard-truncate — send the full document
      // so all accounts are captured. Only truncate if extremely large (over chunk limit).
      const truncatedText = extractedText.length > tokenSettings.chunkCharLimit
        ? extractedText.slice(0, tokenSettings.chunkCharLimit) + '\n...(truncated — very large document)'
        : extractedText;

      const prompt = `You are an expert accountant. Extract trial balance data from this financial statement document.

DOCUMENT TEXT:
\`\`\`
${truncatedText}
\`\`\`

CLIENT'S CHART OF ACCOUNTS (format: id|account_number|account_name|category|normal_balance|import_aliases):
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
      "pdfAccountNumber": "1000",
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
- pdfAccountNumber: the account number as it appears in the document, or null if the document doesn't include account numbers
- pdfAmount: the raw amount string as it appears in the document
- isDebit: true if this is a debit balance (assets, expenses normally), false if credit balance (liabilities, equity, revenue normally)
- debitCents and creditCents: integer cents (multiply dollars by 100). Only one should be non-zero.
- Parentheses negatives like (1,234.56) represent negative amounts. For P&L: parentheses on revenue = debit; for Balance Sheet: parentheses on assets = credit.
- For comparative statements (multiple columns), use the FIRST/CURRENT YEAR column only.
- For P&L: revenue line items have creditCents > 0 (isDebit=false); expense line items have debitCents > 0 (isDebit=true)
- For Balance Sheet: asset line items have debitCents > 0; liability/equity line items have creditCents > 0
- matchedAccountId: use the id from the COA if confident match (prefer exact account number match), else null
- confidence: 0-1 where 1=exact account number match, 0.95=matched via import alias, 0.8=same number different name, 0.7=fuzzy name match, 0=no match
- matchType: "exact" (same account number), "alias" (matched an import alias), "fuzzy" (name/partial match), "none" (no match)
- When the PDF account name matches an entry in the import_aliases column, use matchType "alias" with confidence 0.95
- action: "match" if matched to COA, "create_new" if no match but looks like a real account, "skip" if subtotal/header/total/blank
- category: your best guess at "assets", "liabilities", "equity", "revenue", or "expenses" based on the account name and document section
- warnings: array of strings for any issues found (e.g., "Document appears to be comparative — using current year column", "No account numbers found in document")
- Include ALL line items including those with action="skip"`;

      let messageContent: string | LLMContentPart[];
      if (isScanned) {
        if (!vision.provider.supportsVision) {
          res.status(422).json({
            data: null,
            error: {
              code: 'SCANNED_PDF',
              message: 'This PDF appears to be scanned (no text layer). Configure a vision-capable provider (Claude, OpenAI, or an Ollama vision model) in Settings > AI Provider > Vision Processing.',
            },
          });
          return;
        }
        try {
          const images = await renderPdfToImages(req.file!.buffer);
          if (images.length === 0) throw new Error('No pages rendered');
          const imageParts: LLMContentPart[] = images.map((b64) => ({
            type: 'image' as const,
            base64: b64,
            mimeType: 'image/png' as const,
          }));
          messageContent = [...imageParts, { type: 'text' as const, text: prompt }];
        } catch (visionErr) {
          if (visionErr instanceof PdftoppmNotFoundError) {
            res.status(422).json({
              data: null,
              error: {
                code: 'SCANNED_PDF',
                message: 'Scanned PDF detected. Install poppler-utils on the server (sudo apt install poppler-utils) to enable vision-mode import.',
              },
            });
            return;
          }
          throw visionErr;
        }
      } else {
        messageContent = prompt;
      }

      const [aiProvider, aiModel] = isScanned
        ? [vision.provider, vision.model]
        : [provider, fastModel];
      // Scale output tokens: ~200 tokens per account row. Estimate account count
      // from text length (~80 chars per TB line). Min 4096, max from settings.
      const estimatedAccounts = Math.ceil(extractedText.length / 80);
      const maxTokens = Math.max(tokenSettings.maxTokensDefault, Math.min(tokenSettings.maxTokensBankStatement, estimatedAccounts * 200));
      const aiResult = await aiProvider.complete({
        model: aiModel,
        maxTokens,
        messages: [{ role: 'user', content: messageContent }],
      });
      logAiUsage({ endpoint: 'pdf/analyze', model: aiModel, inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, userId: req.user?.userId, clientId });

      const analysisResult = extractJsonObject<PdfAnalysisResult>(aiResult.text);
      if (!analysisResult) {
        res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'AI returned invalid format' } });
        return;
      }

      res.json({
        data: {
          ...analysisResult,
          extractedTextLength: textLength,
          visionMode: isScanned,
        },
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
  }
);

// ── POST /api/v1/import/pdf/confirm ─────────────────────────────────────────

pdfImportRouter.post('/confirm', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { periodId, clientId, matches, aiExtraction } = req.body as {
      periodId: number;
      clientId: number;
      matches: PdfMatchRow[];
      aiExtraction: unknown;
    };

    if (!periodId || !clientId || !Array.isArray(matches)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'periodId, clientId, and matches are required' } });
      return;
    }

    // Check period exists and belongs to client
    const period = await db('periods').where({ id: periodId, client_id: clientId }).first();
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }

    // Check period is not locked
    if (period.locked_at) {
      res.status(403).json({ data: null, error: { code: 'PERIOD_LOCKED', message: 'Period is locked' } });
      return;
    }

    // Pre-load existing COA accounts to avoid try/catch inside transaction
    const existingCoa = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('id', 'account_number');
    const existingByNumber = new Map<string, number>(
      existingCoa.map((a: { id: number; account_number: string }) => [a.account_number.trim(), a.id])
    );

    // Detect conflicts: user-supplied account numbers that already exist in COA for non-matched rows
    const createNewRows = matches.filter((m) => m.action === 'create_new');
    const seenNumbers = new Map<string, string>();
    for (const m of createNewRows) {
      const num = (m.newAccountNumber?.trim() || m.pdfAccountNumber?.trim()) ?? null;
      if (!num) continue;
      if (seenNumbers.has(num)) {
        res.status(422).json({ data: null, error: { code: 'DUPLICATE_ACCOUNT_NUMBER', message: `Account number "${num}" appears more than once in the import. Each account number must be unique.` } });
        return;
      }
      seenNumbers.set(num, m.pdfAccountName);
    }

    // Wrap all writes in a single transaction — all succeed or all roll back
    const stats = await db.transaction(async (trx) => {
      let accountsCreated = 0;
      let accountsMatched = 0;
      let rowsImported = 0;
      let rowsSkipped = 0;
      const aliasUpdates: Array<{ accountId: number; importName: string }> = [];

      for (const match of matches) {
        if (match.action === 'skip') { rowsSkipped++; continue; }

        let accountId = match.matchedAccountId;

        if (match.action === 'create_new' || (match.action === 'match' && !accountId)) {
          if (!match.pdfAccountName) { rowsSkipped++; continue; }

          const rawNum = match.newAccountNumber?.trim() || match.pdfAccountNumber?.trim() || null;
          // Sanitize: strip non-alphanumeric, enforce varchar(20) limit
          const accountNum = rawNum ? rawNum.replace(/[^a-zA-Z0-9.\-]/g, '').slice(0, 20) : null;

          // If account number already exists in COA, use that account (implicit match)
          if (accountNum && existingByNumber.has(accountNum)) {
            accountId = existingByNumber.get(accountNum)!;
            accountsMatched++;
          } else {
            const category = match.newCategory ?? match.category ?? 'expenses';
            const normalBalance = match.newNormalBalance ??
              (category === 'assets' || category === 'expenses' ? 'debit' : 'credit');

            const finalNum = accountNum || `IMP${Date.now().toString(36).slice(-6).toUpperCase()}`;
            const [newAccount] = await trx('chart_of_accounts')
              .insert({
                client_id: clientId,
                account_number: finalNum,
                account_name: match.pdfAccountName,
                category,
                normal_balance: normalBalance,
                is_active: true,
              })
              .returning('id');
            accountId = newAccount.id;
            existingByNumber.set(finalNum, newAccount.id);
            accountsCreated++;
          }
        } else {
          accountsMatched++;
          if (accountId && match.pdfAccountName?.trim()) {
            aliasUpdates.push({ accountId, importName: match.pdfAccountName.trim() });
          }
        }

        if (!accountId) { rowsSkipped++; continue; }

        await trx('trial_balance')
          .insert({
            period_id: periodId,
            account_id: accountId,
            unadjusted_debit: match.debitCents,
            unadjusted_credit: match.creditCents,
            updated_by: req.user!.userId,
            updated_at: db.fn.now(),
          })
          .onConflict(['period_id', 'account_id'])
          .merge(['unadjusted_debit', 'unadjusted_credit', 'updated_by', 'updated_at']);

        rowsImported++;
      }

      // Apply alias updates — add import name as alias for matched accounts where name differs
      if (aliasUpdates.length > 0) {
        const uniqueIds = [...new Set(aliasUpdates.map((u) => u.accountId))];
        const currentAliasData = await trx('chart_of_accounts')
          .whereIn('id', uniqueIds)
          .select('id', 'account_name', 'import_aliases');
        const aliasMap = new Map(currentAliasData.map((a: { id: number; account_name: string; import_aliases: unknown }) => [
          a.id, { accountName: a.account_name, aliases: parseAliases(a.import_aliases) },
        ]));
        for (const { accountId, importName } of aliasUpdates) {
          const data = aliasMap.get(accountId);
          if (!data) continue;
          if (importName !== data.accountName && !data.aliases.includes(importName)) {
            data.aliases.push(importName);
            await trx('chart_of_accounts')
              .where({ id: accountId })
              .update({ import_aliases: JSON.stringify(data.aliases), updated_at: trx.fn.now() });
          }
        }
      }

      await trx('document_imports').insert({
        client_id: clientId,
        period_id: periodId,
        import_type: 'pdf',
        document_type: 'trial_balance',
        status: 'confirmed',
        ai_extraction: JSON.stringify(aiExtraction ?? null),
        imported_by: req.user!.userId,
        imported_at: db.fn.now(),
      });

      return { accountsMatched, accountsCreated, rowsImported, rowsSkipped };
    });

    res.json({
      data: {
        ...stats,
        accountsWithoutTaxCodes: stats.accountsCreated,
        total: matches.length,
      },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ── POST /api/v1/import/pdf/suggest-numbers ──────────────────────────────────

pdfImportRouter.post('/suggest-numbers', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientId, matches } = req.body as { clientId: number; matches: PdfMatchRow[] };

    if (!clientId || !Array.isArray(matches)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'clientId and matches are required' } });
      return;
    }

    const existing = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('account_number', 'account_name', 'category');
    const existingNumbers = new Set(existing.map((a: { account_number: string }) => a.account_number));

    // Only process create_new rows that have no account number yet
    const needNumbers = matches.filter((m) => m.action === 'create_new' && !m.pdfAccountNumber?.trim() && !m.newAccountNumber?.trim());
    if (needNumbers.length === 0) {
      res.json({ data: { suggestions: [] }, error: null });
      return;
    }

    const existingList = existing.map((a: { account_number: string; account_name: string; category: string }) =>
      `${a.account_number} — ${a.account_name} (${a.category})`
    ).join('\n');

    const accountList = needNumbers.map((m, i) =>
      `Entry ${i}: "${m.pdfAccountName}"${m.newCategory ? ` [category hint: ${m.newCategory}]` : m.category ? ` [detected category: ${m.category}]` : ''}`
    ).join('\n');

    const prompt = `You are an expert accountant. Assign standard chart of accounts numbers to these accounts extracted from a PDF financial statement.

Standard numbering conventions:
- 1000-1999: Assets (1000-1099 cash/bank, 1100-1199 receivables, 1200-1299 inventory, 1300-1499 prepaid/other current, 1500-1999 fixed assets)
- 2000-2999: Liabilities (2000-2099 accounts payable, 2100-2199 accrued liabilities, 2200-2499 other current, 2500-2999 long-term debt)
- 3000-3999: Equity (3000-3099 contributed capital/paid-in, 3900-3999 retained earnings/distributions)
- 4000-4999: Revenue / income
- 5000-5999: Cost of goods sold / direct costs
- 6000-7999: Operating expenses (6000-6999 general & admin, 7000-7999 other operating)
- 8000-8999: Other income/expense, interest, taxes

Existing account numbers already in use (avoid conflicts):
${existingList || '(none)'}

Accounts that need numbers assigned:
${accountList}

Assign numbers with gaps of 10-50 between consecutive entries to allow future insertions. Use the category hint when provided. Infer category from the account name otherwise.

Return ONLY a valid JSON array (no prose, no markdown fences). Each object MUST include the accountName field matching the account name shown above:
[
  { "entryIndex": 0, "accountName": "Cash", "suggestedNumber": "1000", "suggestedCategory": "assets", "suggestedNormalBalance": "debit" }
]`;

    const { provider, fastModel } = await getLLMProvider();
    const aiResult = await provider.complete({
      model: fastModel,
      maxTokens: Math.max(2048, needNumbers.length * 150),
      messages: [{ role: 'user', content: prompt }],
    });
    logAiUsage({ endpoint: 'pdf/suggest-numbers', model: fastModel, inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, userId: req.user?.userId, clientId });

    type SuggestionRaw = { entryIndex: number; accountName?: string; suggestedNumber: string; suggestedCategory: string; suggestedNormalBalance: string };
    const rawSuggestions = extractJsonArray<SuggestionRaw>(aiResult.text);
    if (!rawSuggestions) {
      console.error('[pdf/suggest-numbers] Failed to parse AI response:', aiResult.text.slice(0, 500));
      res.status(500).json({ data: null, error: { code: 'PARSE_ERROR', message: 'AI returned unexpected format' } });
      return;
    }

    // Deduplicate within suggestions; sanitize to digits-only, max 20 chars
    const usedNumbers = new Set(existingNumbers);
    const suggestions = rawSuggestions.map((s) => {
      let num = s.suggestedNumber.replace(/[^0-9]/g, '').slice(0, 20) || '9999';
      while (usedNumbers.has(num)) {
        num = String(parseInt(num, 10) + 1);
      }
      usedNumbers.add(num);
      // Map back via entryIndex; fall back to name matching if index is off-by-one
      const match = needNumbers[s.entryIndex]
        ?? (s.accountName ? needNumbers.find((n) => n.pdfAccountName.toLowerCase() === s.accountName!.toLowerCase()) : undefined)
        ?? needNumbers[s.entryIndex - 1];  // handle 1-indexed AI responses
      const cat = s.suggestedCategory?.toLowerCase().trim();
      const validCat = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'].includes(cat) ? cat : 'expenses';
      const nb = s.suggestedNormalBalance?.toLowerCase().trim();
      const validNb = nb === 'credit' ? 'credit' : 'debit';
      return {
        pdfAccountName: match?.pdfAccountName ?? s.accountName ?? '',
        entryIndex: s.entryIndex,
        suggestedNumber: num,
        suggestedCategory: validCat as 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses',
        suggestedNormalBalance: validNb as 'debit' | 'credit',
      };
    });

    res.json({ data: { suggestions }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ── POST /api/v1/import/pdf/chat ─────────────────────────────────────────────

pdfImportRouter.post('/chat', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { analysis, messages, userMessage, clientId } = req.body as {
      analysis: PdfAnalysisResult & { warnings?: string[]; extractedTextLength?: number };
      messages: { role: 'user' | 'assistant'; content: string }[];
      userMessage: string;
      clientId: number;
    };

    if (!userMessage || !analysis) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'userMessage and analysis are required' } });
      return;
    }

    const coa = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('id', 'account_number', 'account_name', 'category')
      .orderBy('account_number');
    const coaSummary = coa.map((a: { id: number; account_number: string; account_name: string; category: string }) =>
      `${a.id}|${a.account_number}|${a.account_name}|${a.category}`
    ).join('\n');

    const systemPrompt = `You are an expert accountant assistant helping review a PDF financial statement import.

Current analysis result:
\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\`

Client's chart of accounts (id|account_number|account_name|category):
\`\`\`
${coaSummary || '(no accounts yet)'}
\`\`\`

You are in a conversation with the accountant reviewing this import. Your job is to:
1. Explain what was extracted from the PDF in plain language
2. Answer questions about specific line items, account matching, or amounts
3. If the user asks to correct the analysis (e.g., "that account should be revenue not expenses", "skip row 3"), produce a corrected analysis

Respond ONLY with a valid JSON object (no prose, no markdown fences):
{
  "reply": "your helpful response in plain text (use \\n for line breaks)",
  "revisedAnalysis": null
}

If the user requests corrections to the account matching, categories, or actions, set revisedAnalysis to a complete corrected analysis object using the same structure. Otherwise set revisedAnalysis to null.`;

    const aiMessages = [
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const { provider: pdfProvider, fastModel: pdfFastModel } = await getLLMProvider();
    const aiResult2 = await pdfProvider.complete({
      model: pdfFastModel,
      maxTokens: 2048,
      system: systemPrompt,
      messages: aiMessages,
    });
    logAiUsage({ endpoint: 'pdf/chat', model: pdfFastModel, inputTokens: aiResult2.inputTokens, outputTokens: aiResult2.outputTokens, userId: req.user?.userId, clientId });

    const parsed = extractJsonObject<{ reply: string; revisedAnalysis: PdfAnalysisResult | null }>(aiResult2.text);
    if (!parsed) {
      res.json({ data: { reply: aiResult2.text.trim(), revisedAnalysis: null }, error: null });
      return;
    }
    res.json({ data: parsed, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ── GET /api/v1/import/pdf/imports?periodId=X ────────────────────────────────

pdfImportRouter.get('/imports', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const periodId = Number(req.query.periodId);
    if (isNaN(periodId) || periodId <= 0) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'periodId query param required' } });
      return;
    }

    const imports = await db('document_imports')
      .where({ period_id: periodId })
      .select('id', 'import_type', 'document_type', 'status', 'imported_at')
      .orderBy('imported_at', 'desc');

    res.json({ data: imports, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ── POST /api/v1/import/pdf/verify/:importId ─────────────────────────────────

pdfImportRouter.post('/verify/:importId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const importId = Number(req.params.importId);
    const { periodId } = req.body as { periodId: number };

    if (isNaN(importId) || !periodId) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'importId and periodId are required' } });
      return;
    }

    // Validate period exists (ownership check — period table is the authoritative source)
    const period = await db('periods').where({ id: periodId }).first('id', 'client_id');
    if (!period) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Period not found' } });
      return;
    }

    // Load document_imports record
    const docImport = await db('document_imports').where({ id: importId, period_id: periodId }).first();
    if (!docImport) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Import record not found for this period' } });
      return;
    }

    // Load adjusted trial balance from view
    const tbRows = await db('v_adjusted_trial_balance')
      .where({ period_id: periodId, is_active: true })
      .select('account_number', 'account_name', 'book_adjusted_debit', 'book_adjusted_credit');

    // Build TB summary (net balance in cents)
    const tbSummary = tbRows.map((r: Record<string, unknown>) => {
      const dr = Number(r.book_adjusted_debit ?? 0);
      const cr = Number(r.book_adjusted_credit ?? 0);
      return {
        account_name: String(r.account_name ?? ''),
        account_number: String(r.account_number ?? ''),
        balance_cents: dr - cr,
      };
    });

    // Parse ai_extraction
    let aiExtraction: PdfAnalysisResult | null = null;
    try {
      if (typeof docImport.ai_extraction === 'string') {
        aiExtraction = JSON.parse(docImport.ai_extraction) as PdfAnalysisResult;
      } else if (docImport.ai_extraction && typeof docImport.ai_extraction === 'object') {
        aiExtraction = docImport.ai_extraction as PdfAnalysisResult;
      }
    } catch {
      // ignore parse error
    }

    // Build PDF summary from ai_extraction.matches
    const pdfSummary = (aiExtraction?.matches ?? [])
      .filter((m: PdfMatchRow) => m.action !== 'skip')
      .map((m: PdfMatchRow) => ({
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

    const { provider: verifyProvider, fastModel: verifyModel } = await getLLMProvider();
    const aiResult3 = await verifyProvider.complete({
      model: verifyModel,
      maxTokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    logAiUsage({ endpoint: 'pdf/verify', model: verifyModel, inputTokens: aiResult3.inputTokens, outputTokens: aiResult3.outputTokens, userId: req.user?.userId, clientId: period.client_id });

    type VerificationResult = {
      overallStatus: 'verified' | 'discrepancies';
      summary: { total: number; matched: number; discrepancies: number; missingFromTb: number; extraInTb: number };
      details: Array<{
        accountName: string;
        accountNumber: string;
        pdfAmount: number | null;
        tbAmount: number | null;
        difference: number;
        status: 'match' | 'discrepancy' | 'missing_from_tb' | 'extra_in_tb';
        severity: 'none' | 'low' | 'medium' | 'high';
      }>;
    };
    const verificationResult = extractJsonObject<VerificationResult>(aiResult3.text);
    if (!verificationResult) {
      res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'AI returned invalid format' } });
      return;
    }

    // Store result and update status
    await db('document_imports')
      .where({ id: importId })
      .update({
        verification_result: JSON.stringify(verificationResult),
        status: verificationResult.overallStatus,
        verified_by: req.user!.userId,
        verified_at: db.fn.now(),
      });

    res.json({ data: verificationResult, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ── GET /api/v1/import/pdf/verify/:importId ──────────────────────────────────

pdfImportRouter.get('/verify/:importId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const importId = Number(req.params.importId);
    if (isNaN(importId)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'Invalid importId' } });
      return;
    }

    const docImport = await db('document_imports').where({ id: importId }).first();
    if (!docImport) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Import not found' } });
      return;
    }

    if (!docImport.verification_result) {
      res.status(404).json({ data: null, error: { code: 'NOT_VERIFIED', message: 'Not verified yet' } });
      return;
    }

    let verificationResult: unknown;
    try {
      if (typeof docImport.verification_result === 'string') {
        verificationResult = JSON.parse(docImport.verification_result) as unknown;
      } else {
        verificationResult = docImport.verification_result;
      }
    } catch {
      verificationResult = docImport.verification_result;
    }

    res.json({ data: verificationResult, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
