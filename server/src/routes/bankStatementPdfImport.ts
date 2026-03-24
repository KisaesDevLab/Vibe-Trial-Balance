// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2024–2026 [Project Author]

import { Router, Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { createHash } from 'crypto';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAiUsage } from '../lib/aiUsage';
import { getLLMProvider } from '../lib/aiClient';
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

function buildTextPrompt(text: string): string {
  // Mask account numbers and truncate to first ~50k chars
  const masked = maskAccountNumbers(text);
  const truncated = masked.slice(0, 50000);
  return `You are an expert accountant. Extract bank transactions from this bank statement.

BANK STATEMENT TEXT:
\`\`\`
${truncated}
\`\`\`

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
- checkNumber: extract check numbers from descriptions like "CHECK #1234", "CHK 1234"
- payeeName: extract the merchant/payee from the transaction description
- category: your best guess (e.g., "utilities", "payroll", "office supplies", "transfer", "deposit", "interest")
- openingBalance and closingBalance in cents from the statement header/footer
- Skip headers, footers, subtotals, daily balance rows — only include actual transactions
- warnings: note any issues
- accountNumberLast4: return ONLY the last 4 digits of any bank account number — do NOT return the full account number`;
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
      const { provider, primaryModel } = await getLLMProvider();

      // Prefer vision mode for bank statements (check images contain payee info)
      let useVision = provider.supportsVision;
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
              message: 'This PDF appears to be scanned (no text layer). Switch to a vision-capable provider (Claude or an Ollama vision model) to import scanned bank statements.',
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

      // Use primaryModel for bank statements — they can be long
      const aiResult = await provider.complete({
        model: primaryModel,
        maxTokens: 8192,
        messages: [{ role: 'user', content: messageContent! }],
      });
      logAiUsage({ endpoint: 'bank-statement-pdf/analyze', model: primaryModel, inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, userId: req.user?.userId, clientId });

      const analysisResult = extractJsonObject<BankStatementAnalysisResult>(aiResult.text);
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
