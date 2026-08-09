// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { Router, Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { createHash } from 'crypto';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { assertPeriodUnlocked } from '../lib/periodGuard';
import { logAiUsage } from '../lib/aiUsage';
import { aiComplete, markAiUsageParseError } from '../lib/aiComplete';
import { getLLMProvider, getAiTokenSettings } from '../lib/aiClient';
import { TB_TASK_CLASSES } from '../lib/routerProvider';
import { renderPdfToImages, PdftoppmNotFoundError } from '../lib/pdfVision';
import type { LLMContentPart } from '../lib/llmProvider';
import { extractJsonObject } from '../lib/aiJsonExtract';
import { sendServerError } from '../lib/safeError';
import { loadOcrSettings, isOcrConfigured, ocrPages } from '../lib/ocrProvider';

export const bankStatementPdfRouter = Router();
bankStatementPdfRouter.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Types ────────────────────────────────────────────────────────────────────

interface BankStatementTransaction {
  date: string;
  description: string;
  amount: number; // cents, positive = deposit, negative = withdrawal
  checkNumber: string | null;
  payeeName: string | null;
  category: string | null;
}

interface BankStatementAnalysisResult {
  bankName: string | null;
  accountNumberLast4: string | null;
  statementPeriod: { start: string; end: string } | null;
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: BankStatementTransaction[];
  warnings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// v2 dedup key — must stay in sync with txHash in bankTransactions.ts.
function txHash(
  date: string,
  description: string,
  amount: number,
  checkNumber: string | null,
  sourceAccountId: number | null,
  ordinal: number,
): string {
  const key = `${date}|${description}|${amount}|${checkNumber ?? ''}|${sourceAccountId ?? ''}|${ordinal}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 64);
}

// Pre-v2 hash format; consulted for first occurrences so upgrading does not
// duplicate previously imported statements.
function legacyTxHash(date: string, description: string, amount: number): string {
  return createHash('sha256').update(`${date}|${description}|${amount}`).digest('hex').slice(0, 64);
}

/**
 * Mask bank/financial account numbers in extracted text to avoid sending full
 * account numbers to cloud AI providers. Preserves the last 4 digits.
 * Matches patterns like: Account Number: 1234567890, Acct#: 12-3456-7890, etc.
 */
function maskAccountNumbers(text: string): string {
  // Mask sequences of 6+ digits (possibly separated by dashes/spaces) that look like account numbers
  // Preserve last 4 digits, replace earlier digits with X
  return text.replace(
    /(?:account|acct|routing|aba)[\s#:.]*(\d[\d\s-]{4,})/gi,
    (match, digits: string) => {
      const cleaned = digits.replace(/[\s-]/g, '');
      if (cleaned.length < 6) return match;
      const masked = 'X'.repeat(cleaned.length - 4) + cleaned.slice(-4);
      return match.replace(digits, masked);
    },
  );
}

const VISION_PROMPT = `You are an expert accountant. Extract bank transactions from this bank statement.

The images show pages of a bank statement. Extract EVERY transaction listed.

For check images: if you can see a payee name written on the check (the "Pay to the Order of" line), include it in the payeeName field.

Return ONLY a valid JSON object (no prose, no markdown fences, no code blocks):
{
  "bankName": "First National Bank",
  "accountNumberLast4": "1234",
  "statementPeriod": { "start": "2024-01-01", "end": "2024-01-31" },
  "openingBalance": 1500000,
  "closingBalance": 1650000,
  "transactions": [
    {
      "date": "2024-01-05",
      "description": "CHECK #1234",
      "amount": -50000,
      "checkNumber": "1234",
      "payeeName": "ABC Vendor Inc",
      "category": "vendor payment"
    }
  ],
  "warnings": []
}

Rules:
- All amounts in integer CENTS (multiply dollars by 100, round to nearest cent)
- Deposits/credits are POSITIVE amounts
- Withdrawals/debits/checks are NEGATIVE amounts
- date format: YYYY-MM-DD
- checkNumber: extract check numbers from descriptions like "CHECK #1234", "CHK 1234", or from check images
- payeeName: for checks, try to read the "Pay to the Order of" line from check images; for electronic transactions, extract the merchant/payee from the description
- category: your best guess (e.g., "utilities", "payroll", "office supplies", "transfer", "deposit", "interest")
- openingBalance and closingBalance in cents from the statement header/footer
- Skip headers, footers, subtotals, daily balance rows — only include actual transactions
- warnings: note any issues (e.g., "Page 3 was partially unreadable", "Some check images were too blurry to read payee")
- accountNumberLast4: return ONLY the last 4 digits of any bank account number — do NOT return the full account number`;

const TEXT_RULES = `Rules:
- All amounts in integer CENTS (multiply dollars by 100, round to nearest cent)
- Deposits/credits are POSITIVE amounts
- Withdrawals/debits/checks are NEGATIVE amounts
- date format: YYYY-MM-DD
- checkNumber: extract check numbers from descriptions like "CHECK #1234", "CHK 1234"
- payeeName: extract the merchant/payee from the transaction description
- category: your best guess (e.g., "utilities", "payroll", "office supplies", "transfer", "deposit", "interest")
- openingBalance and closingBalance in cents from the statement header/footer
- Skip headers, footers, subtotals, daily balance rows — only include actual transactions
- warnings: note any issues
- accountNumberLast4: return ONLY the last 4 digits of any bank account number — do NOT return the full account number`;

const JSON_EXAMPLE = `{
  "bankName": "First National Bank",
  "accountNumberLast4": "1234",
  "statementPeriod": { "start": "2024-01-01", "end": "2024-01-31" },
  "openingBalance": 1500000,
  "closingBalance": 1650000,
  "transactions": [
    {
      "date": "2024-01-05",
      "description": "CHECK #1234",
      "amount": -50000,
      "checkNumber": "1234",
      "payeeName": "ABC Vendor Inc",
      "category": "vendor payment"
    }
  ],
  "warnings": []
}`;

function buildTextPrompt(text: string): string {
  const masked = maskAccountNumbers(text);
  return `You are an expert accountant. Extract bank transactions from this bank statement.

BANK STATEMENT TEXT:
\`\`\`
${masked}
\`\`\`

Return ONLY a valid JSON object (no prose, no markdown fences, no code blocks):
${JSON_EXAMPLE}

${TEXT_RULES}`;
}

/** Build prompt for a chunk of a large statement (transactions only, no metadata) */
function buildChunkPrompt(text: string, chunkIndex: number, totalChunks: number): string {
  const masked = maskAccountNumbers(text);
  return `You are an expert accountant. Extract bank transactions from this SECTION of a bank statement (part ${chunkIndex + 1} of ${totalChunks}).

BANK STATEMENT TEXT (partial):
\`\`\`
${masked}
\`\`\`

Return ONLY a valid JSON object with just the transactions found in this section:
{
  "transactions": [
    {
      "date": "2024-01-05",
      "description": "CHECK #1234",
      "amount": -50000,
      "checkNumber": "1234",
      "payeeName": "ABC Vendor Inc",
      "category": "vendor payment"
    }
  ],
  "warnings": []
}

${TEXT_RULES}
- This is a partial section — only extract transactions visible in this text.`;
}

/**
 * Split large text into chunks, each under the given char limit.
 * Tries progressively finer split points to avoid cutting mid-transaction:
 *   1. Form-feed characters (page breaks in PDFs)
 *   2. Double-newlines (section breaks)
 *   3. Single newlines (line-by-line, last resort)
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  // Try split strategies in order of preference
  const separators = [/\f/, /\n{2,}/, /\n/];
  for (const sep of separators) {
    const sections = text.split(sep);
    if (sections.length <= 1) continue;

    const chunks: string[] = [];
    let current = '';
    for (const section of sections) {
      if (current.length + section.length + 2 > maxChars && current.length > 0) {
        chunks.push(current);
        current = section;
      } else {
        current += (current ? '\n\n' : '') + section;
      }
    }
    if (current) chunks.push(current);

    // Only use this strategy if it actually produced multiple chunks
    if (chunks.length > 1) return chunks;
  }

  // Absolute fallback: hard-split at maxChars boundaries on newlines
  const chunks: string[] = [];
  const lines = text.split('\n');
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ── POST /api/v1/import/bank-statement-pdf/analyze ──────────────────────────

bankStatementPdfRouter.post(
  '/analyze',
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ data: null, error: { code: 'NO_FILE', message: 'No file uploaded' } });
        return;
      }

      const clientId = Number(req.body.clientId);
      if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'clientId is required' } });
        return;
      }

      // Extract text for fallback / scanned detection
      let extractedText = '';
      let textLength = 0;
      try {
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text ?? '';
        textLength = extractedText.replace(/\s/g, '').length;
      } catch {
        // pdf-parse can fail on some files; treat as scanned
        textLength = 0;
      }

      const isScanned = textLength < 100;
      const { provider, primaryModel, vision } = await getLLMProvider();

      // ── OCR pre-processing (optional) ──────────────────────────────────────
      const ocrSettings = await loadOcrSettings();
      const requestOcr = req.body.useOcr === 'true' && isOcrConfigured(ocrSettings);
      let ocrMode = false;
      const ocrWarnings: string[] = [];

      if (requestOcr) {
        try {
          const images = await renderPdfToImages(req.file.buffer, 20);
          if (images.length === 0) throw new Error('No pages rendered from PDF');

          console.log(`[bank-pdf] OCR: processing ${images.length} pages via ${ocrSettings.model}`);
          const ocrResult = await ocrPages(ocrSettings, images);
          logAiUsage({ endpoint: 'bank-statement-pdf/analyze-ocr', model: ocrSettings.model, inputTokens: ocrResult.totalInputTokens, outputTokens: ocrResult.totalOutputTokens, userId: req.user?.userId, clientId });
          ocrWarnings.push(...ocrResult.warnings);

          const ocrText = ocrResult.texts.join('\n\n--- Page Break ---\n\n');
          const ocrTextLength = ocrText.replace(/\s/g, '').length;

          if (ocrTextLength < 50) {
            // OCR ran but produced negligible text — fall back to standard flow
            console.warn(`[bank-pdf] OCR produced only ${ocrTextLength} chars — falling back to standard flow`);
            ocrWarnings.push('OCR produced very little text. Falling back to standard extraction.');
          } else {
            extractedText = ocrText;
            textLength = ocrTextLength;
            ocrMode = true;
            console.log(`[bank-pdf] OCR complete: ${ocrText.length} chars from ${images.length} pages`);
          }
        } catch (ocrErr) {
          // Log full error server-side, send generic message to client
          const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
          console.warn(`[bank-pdf] OCR failed, falling back to standard flow:`, msg);
          ocrWarnings.push('OCR pre-processing failed. Falling back to standard extraction.');
        }
      }

      // Prefer vision mode for bank statements (check images contain payee info)
      // Skip vision if OCR already produced text — use the text-based path instead
      let useVision = !ocrMode && vision.provider.supportsVision;
      let visionFailed = false;
      let messageContent: string | LLMContentPart[];

      if (useVision) {
        try {
          const images = await renderPdfToImages(req.file.buffer, 20);
          if (images.length === 0) {
            useVision = false;
            visionFailed = true;
          } else {
            const imageParts: LLMContentPart[] = images.map((b64) => ({
              type: 'image' as const,
              base64: b64,
              mimeType: 'image/png' as const,
            }));
            messageContent = [...imageParts, { type: 'text' as const, text: VISION_PROMPT }];
          }
        } catch (err) {
          if (err instanceof PdftoppmNotFoundError) {
            useVision = false;
            visionFailed = true;
          } else {
            throw err;
          }
        }
      }

      // Re-evaluate scanned status: OCR may have produced text from a scanned PDF
      const effectivelyScanned = !ocrMode && textLength < 100;

      if (!useVision) {
        if (effectivelyScanned && !visionFailed) {
          res.status(422).json({
            data: null,
            error: {
              code: 'SCANNED_PDF',
              message: 'This PDF appears to be scanned (no text layer). Configure a vision-capable provider (Claude, OpenAI, or an Ollama vision model) in Settings > AI Provider > Vision Processing, or enable OCR pre-processing.',
            },
          });
          return;
        }
        if (effectivelyScanned && visionFailed) {
          res.status(422).json({
            data: null,
            error: {
              code: 'SCANNED_PDF',
              message: 'Scanned PDF detected. Install poppler-utils on the server (sudo apt install poppler-utils) to enable vision-mode import, or enable OCR pre-processing.',
            },
          });
          return;
        }
        messageContent = buildTextPrompt(extractedText);
      }

      // Read configurable token limits from settings
      const tokenSettings = await getAiTokenSettings();
      const needsChunking = !useVision && extractedText.length > tokenSettings.chunkCharLimit;

      let analysisResult: BankStatementAnalysisResult | null = null;

      if (needsChunking) {
        // ── Chunked processing for large statements ──
        const chunks = splitTextIntoChunks(extractedText, tokenSettings.chunkCharLimit);
        const allTransactions: BankStatementTransaction[] = [];
        const allWarnings: string[] = [`Statement processed in ${chunks.length} chunks due to size (${Math.round(extractedText.length / 1024)}KB text).`];
        console.log(`[bank-pdf] Chunked: ${chunks.length} chunks from ${extractedText.length} chars (limit: ${tokenSettings.chunkCharLimit}). Chunk sizes: ${chunks.map((c) => c.length).join(', ')}`);

        // Process all chunks — first gets full prompt (metadata + transactions),
        // rest get transaction-only prompt
        for (let i = 0; i < chunks.length; i++) {
          const prompt = i === 0
            ? buildTextPrompt(chunks[i])
            : buildChunkPrompt(chunks[i], i, chunks.length);

          const { result: chunkResult, logId: chunkLogId } = await aiComplete(
            provider,
            { model: primaryModel, taskClass: TB_TASK_CLASSES.BANK_STATEMENT_EXTRACT, maxTokens: tokenSettings.maxTokensBankStatement, messages: [{ role: 'user', content: prompt }] },
            { endpoint: 'bank-statement-pdf/analyze', userId: req.user?.userId, userRole: req.user?.role, clientId },
          );

          const hitTokenLimit = chunkResult.outputTokens >= tokenSettings.maxTokensBankStatement - 10;
          console.log(`[bank-pdf] Chunk ${i + 1}/${chunks.length}: ${chunkResult.outputTokens} output tokens${hitTokenLimit ? ' (HIT LIMIT — output likely truncated!)' : ''}`);

          const parsed = extractJsonObject<BankStatementAnalysisResult & { transactions?: BankStatementTransaction[]; warnings?: string[] }>(chunkResult.text);

          if (!parsed && hitTokenLimit) {
            // Output was truncated — re-split this chunk and retry with smaller pieces
            allWarnings.push(`Chunk ${i + 1} exceeded token limit and was re-split.`);
            const subChunks = splitTextIntoChunks(chunks[i], Math.floor(tokenSettings.chunkCharLimit / 2));
            console.log(`[bank-pdf] Re-splitting chunk ${i + 1} into ${subChunks.length} sub-chunks`);
            for (let j = 0; j < subChunks.length; j++) {
              const subPrompt = buildChunkPrompt(subChunks[j], j, subChunks.length);
              const { result: subResult, logId: subLogId } = await aiComplete(
                provider,
                { model: primaryModel, taskClass: TB_TASK_CLASSES.BANK_STATEMENT_EXTRACT, maxTokens: tokenSettings.maxTokensBankStatement, messages: [{ role: 'user', content: subPrompt }] },
                { endpoint: 'bank-statement-pdf/analyze', userId: req.user?.userId, userRole: req.user?.role, clientId },
              );
              console.log(`[bank-pdf] Sub-chunk ${j + 1}/${subChunks.length}: ${subResult.outputTokens} output tokens`);
              const subParsed = extractJsonObject<{ transactions?: BankStatementTransaction[]; warnings?: string[] }>(subResult.text);
              if (subParsed?.transactions) allTransactions.push(...subParsed.transactions);
              if (subParsed?.warnings) allWarnings.push(...subParsed.warnings);
              if (!subParsed) markAiUsageParseError(subLogId, `Sub-chunk invalid JSON (finish=${subResult.stopReason ?? 'unknown'}).`);
            }
            continue;
          }

          if (parsed) {
            if (i === 0 && !analysisResult) {
              // First chunk — extract metadata
              analysisResult = { ...parsed, transactions: [], warnings: [] };
            }
            if (parsed.transactions) {
              allTransactions.push(...parsed.transactions);
              console.log(`[bank-pdf] Chunk ${i + 1}: extracted ${parsed.transactions.length} transactions`);
            }
            if (parsed.warnings) allWarnings.push(...parsed.warnings);
          } else {
            allWarnings.push(`Chunk ${i + 1} failed to parse — some transactions may be missing.`);
            console.warn(`[bank-pdf] Chunk ${i + 1} failed to parse. Raw output (first 500 chars): ${chunkResult.text.slice(0, 500)}`);
            markAiUsageParseError(chunkLogId, `Chunk ${i + 1} invalid JSON (finish=${chunkResult.stopReason ?? 'unknown'}).`);
          }
        }

        console.log(`[bank-pdf] Total extracted: ${allTransactions.length} transactions from ${chunks.length} chunks`);

        // Merge into final result
        if (!analysisResult) {
          analysisResult = {
            bankName: null,
            accountNumberLast4: null,
            statementPeriod: null,
            openingBalance: null,
            closingBalance: null,
            transactions: allTransactions,
            warnings: allWarnings,
          };
        } else {
          analysisResult.transactions = allTransactions;
          analysisResult.warnings = allWarnings;
        }
      } else {
        // ── Single-call processing (vision or small text) ──
        // Estimate maxTokens: ~80 tokens per transaction in output, capped by settings
        const estimatedTxns = useVision ? 400 : Math.ceil(extractedText.length / 200);
        const maxTokens = Math.max(tokenSettings.maxTokensDefault, Math.min(tokenSettings.maxTokensBankStatement * 4, estimatedTxns * 80));

        const [aiProvider, aiModel] = useVision
          ? [vision.provider, vision.model]
          : [provider, primaryModel];
        const { result: aiResult, logId: singleLogId } = await aiComplete(
          aiProvider,
          { model: aiModel, taskClass: TB_TASK_CLASSES.BANK_STATEMENT_EXTRACT, maxTokens, messages: [{ role: 'user', content: messageContent! }] },
          { endpoint: 'bank-statement-pdf/analyze', userId: req.user?.userId, userRole: req.user?.role, clientId },
        );

        analysisResult = extractJsonObject<BankStatementAnalysisResult>(aiResult.text);
        if (!analysisResult) {
          const detail = `finish=${aiResult.stopReason ?? 'unknown'}, text[0..500]=${JSON.stringify(aiResult.text.slice(0, 500))}`;
          console.error(`[bank-pdf] Failed to parse AI response: ${detail}`);
          markAiUsageParseError(singleLogId, `Invalid JSON. ${detail}`);
        }
      }

      if (!analysisResult) {
        res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'AI returned invalid format. Please try again.' } });
        return;
      }

      // Validate/sanitize transactions. Amounts must be integer cents — the AI
      // is instructed to multiply dollars by 100, but a fractional value here
      // would abort the confirm insert against the BIGINT column, so round
      // defensively at this trust boundary.
      const txns = (analysisResult.transactions ?? []).map((t) => ({
        date: t.date ?? '',
        description: t.description ?? '',
        amount: typeof t.amount === 'number' && Number.isFinite(t.amount) ? Math.round(t.amount) : 0,
        checkNumber: t.checkNumber ?? null,
        payeeName: t.payeeName ?? null,
        category: t.category ?? null,
      })).filter((t) => t.date && t.description && t.amount !== 0);

      res.json({
        data: {
          bankName: analysisResult.bankName ?? null,
          accountNumberLast4: analysisResult.accountNumberLast4 ?? null,
          statementPeriod: analysisResult.statementPeriod ?? null,
          openingBalance: analysisResult.openingBalance ?? null,
          closingBalance: analysisResult.closingBalance ?? null,
          transactions: txns,
          warnings: [...ocrWarnings, ...(analysisResult.warnings ?? [])],
          visionMode: useVision,
          ocrMode,
          extractedTextLength: textLength,
        },
        error: null,
      });
    } catch (err: unknown) {
      sendServerError(res, err, 'bank-pdf');
    }
  },
);

// ── POST /api/v1/import/bank-statement-pdf/confirm ──────────────────────────

bankStatementPdfRouter.post('/confirm', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientId, periodId, sourceAccountId, transactions } = req.body as {
      clientId: number;
      periodId: number | null;
      sourceAccountId: number;
      transactions: BankStatementTransaction[];
    };

    if (!clientId || !sourceAccountId || !Array.isArray(transactions)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'clientId, sourceAccountId, and transactions are required' } });
      return;
    }

    // Validate source account exists for this client
    const sourceAccount = await db('chart_of_accounts').where({ id: sourceAccountId, client_id: clientId }).first();
    if (!sourceAccount) {
      res.status(400).json({ data: null, error: { code: 'INVALID_ACCOUNT', message: 'Source account not found for this client' } });
      return;
    }

    let imported = 0;
    let duplicates = 0;

    await db.transaction(async (trx) => {
      // If a period was supplied, lock it and fail fast if it's sealed. Imports into
      // a locked period must not create bank transactions (and later JEs).
      if (periodId) {
        await assertPeriodUnlocked(periodId, trx);
      }

      // Occurrence ordinals let legitimate within-statement duplicates coexist.
      const occurrenceCounts = new Map<string, number>();
      const legacyCandidates = [...new Set(
        transactions
          .filter((t) => t.date && t.description && Number.isInteger(t.amount) && t.amount !== 0)
          .map((t) => legacyTxHash(t.date, t.description, t.amount)),
      )];
      const existingLegacy = new Set<string>(
        legacyCandidates.length > 0
          ? await trx('bank_transactions')
              .where({ client_id: clientId })
              .whereIn('import_hash', legacyCandidates)
              .pluck('import_hash')
          : [],
      );

      for (const tx of transactions) {
        // Reject non-integer amounts outright: the analyze endpoint rounds, but
        // /confirm accepts a raw client payload and writes to a BIGINT column.
        if (!tx.date || !tx.description || !Number.isInteger(tx.amount) || tx.amount === 0) continue;

        const key = `${tx.date}|${tx.description}|${tx.amount}|${tx.checkNumber ?? ''}|${sourceAccountId ?? ''}`;
        const ordinal = occurrenceCounts.get(key) ?? 0;
        occurrenceCounts.set(key, ordinal + 1);
        if (ordinal === 0 && existingLegacy.has(legacyTxHash(tx.date, tx.description, tx.amount))) {
          duplicates++;
          continue;
        }
        const hash = txHash(tx.date, tx.description, tx.amount, tx.checkNumber ?? null, sourceAccountId, ordinal);

        // Build the description — prepend payee name if available and different from description
        let finalDesc = tx.description;
        if (tx.payeeName && tx.payeeName !== tx.description && !tx.description.toLowerCase().includes(tx.payeeName.toLowerCase())) {
          finalDesc = `${tx.payeeName} — ${tx.description}`;
        }

        // Use ON CONFLICT IGNORE rather than try/catch: a raw unique-violation inside
        // a PG transaction aborts the whole trx (25P02), which would silently drop
        // every remaining row after the first duplicate.
        const inserted = await trx('bank_transactions')
          .insert({
            client_id: clientId,
            period_id: periodId ?? null,
            source_account_id: sourceAccountId,
            transaction_date: tx.date,
            description: finalDesc,
            amount: tx.amount,
            check_number: tx.checkNumber ?? null,
            classification_status: 'unclassified',
            import_hash: hash,
            entry_source: 'import',
          })
          .onConflict(['client_id', 'import_hash'])
          .ignore()
          .returning('id');

        if (inserted.length > 0) imported++;
        else duplicates++;
      }
    });

    res.json({
      data: { imported, duplicates, total: transactions.length },
      error: null,
    });
  } catch (err: unknown) {
    sendServerError(res, err, 'bank-pdf');
  }
});
