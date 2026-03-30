// SPDX-License-Identifier: BUSL-1.1
// Copyright (C) 2024–2026 Kisaes LLC

import { Router, Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { createHash } from 'crypto';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAiUsage } from '../lib/aiUsage';
import { getLLMProvider, getAiTokenSettings } from '../lib/aiClient';
import { renderPdfToImages, PdftoppmNotFoundError } from '../lib/pdfVision';
import type { LLMContentPart } from '../lib/llmProvider';
import { extractJsonObject } from '../lib/aiJsonExtract';

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

function txHash(date: string, description: string, amount: number): string {
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

      // Prefer vision mode for bank statements (check images contain payee info)
      let useVision = vision.provider.supportsVision;
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

      if (!useVision) {
        if (isScanned && !visionFailed) {
          res.status(422).json({
            data: null,
            error: {
              code: 'SCANNED_PDF',
              message: 'This PDF appears to be scanned (no text layer). Configure a vision-capable provider (Claude, OpenAI, or an Ollama vision model) in Settings > AI Provider > Vision Processing.',
            },
          });
          return;
        }
        if (isScanned && visionFailed) {
          res.status(422).json({
            data: null,
            error: {
              code: 'SCANNED_PDF',
              message: 'Scanned PDF detected. Install poppler-utils on the server (sudo apt install poppler-utils) to enable vision-mode import.',
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

          const chunkResult = await provider.complete({
            model: primaryModel,
            maxTokens: tokenSettings.maxTokensBankStatement,
            messages: [{ role: 'user', content: prompt }],
          });
          logAiUsage({ endpoint: 'bank-statement-pdf/analyze', model: primaryModel, inputTokens: chunkResult.inputTokens, outputTokens: chunkResult.outputTokens, userId: req.user?.userId, clientId });

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
              const subResult = await provider.complete({
                model: primaryModel,
                maxTokens: tokenSettings.maxTokensBankStatement,
                messages: [{ role: 'user', content: subPrompt }],
              });
              logAiUsage({ endpoint: 'bank-statement-pdf/analyze', model: primaryModel, inputTokens: subResult.inputTokens, outputTokens: subResult.outputTokens, userId: req.user?.userId, clientId });
              console.log(`[bank-pdf] Sub-chunk ${j + 1}/${subChunks.length}: ${subResult.outputTokens} output tokens`);
              const subParsed = extractJsonObject<{ transactions?: BankStatementTransaction[]; warnings?: string[] }>(subResult.text);
              if (subParsed?.transactions) allTransactions.push(...subParsed.transactions);
              if (subParsed?.warnings) allWarnings.push(...subParsed.warnings);
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
        const aiResult = await aiProvider.complete({
          model: aiModel,
          maxTokens,
          messages: [{ role: 'user', content: messageContent! }],
        });
        logAiUsage({ endpoint: 'bank-statement-pdf/analyze', model: aiModel, inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, userId: req.user?.userId, clientId });

        analysisResult = extractJsonObject<BankStatementAnalysisResult>(aiResult.text);
      }

      if (!analysisResult) {
        res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'AI returned invalid format. Please try again.' } });
        return;
      }

      // Validate/sanitize transactions
      const txns = (analysisResult.transactions ?? []).map((t) => ({
        date: t.date ?? '',
        description: t.description ?? '',
        amount: typeof t.amount === 'number' ? t.amount : 0,
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
          warnings: analysisResult.warnings ?? [],
          visionMode: useVision,
          extractedTextLength: textLength,
        },
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
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
      for (const tx of transactions) {
        if (!tx.date || !tx.description || tx.amount === 0) continue;

        const hash = txHash(tx.date, tx.description, tx.amount);

        // Build the description — prepend payee name if available and different from description
        let finalDesc = tx.description;
        if (tx.payeeName && tx.payeeName !== tx.description && !tx.description.toLowerCase().includes(tx.payeeName.toLowerCase())) {
          finalDesc = `${tx.payeeName} — ${tx.description}`;
        }

        try {
          await trx('bank_transactions').insert({
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
          });
          imported++;
        } catch (insertErr: unknown) {
          const e = insertErr as { constraint?: string; code?: string };
          // Unique constraint violation = duplicate
          if (e.constraint === 'ubt_client_import_hash' || e.code === '23505') {
            duplicates++;
          } else {
            throw insertErr;
          }
        }
      }
    });

    res.json({
      data: { imported, duplicates, total: transactions.length },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
