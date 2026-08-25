// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Scanned-sheet import for the Transaction Entry register.
 *
 * Clients hand in scanned PDFs of HANDWRITTEN sheets: one line per item with a
 * description and an amount, usually no per-line dates, deposits and payments
 * mixed. `POST /analyze` renders each page, has the vision model transcribe the
 * line items (one call per page so every row carries a page number and a bad
 * page can't sink the whole sheet), and returns the rows plus lightweight page
 * previews so the user can check the handwriting side by side. Nothing is
 * written here — the register's Save does that once the user has reviewed.
 *
 * Mirrors bankStatementPdfImport.ts for the vision / OCR / SCANNED_PDF
 * decision flow and the aiComplete + task-class conventions.
 */

import { Router, Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAiUsage } from '../lib/aiUsage';
import { aiComplete, markAiUsageParseError } from '../lib/aiComplete';
import { getLLMProvider, getAiTokenSettings } from '../lib/aiClient';
import { TB_TASK_CLASSES } from '../lib/routerProvider';
import { renderPdfToImages, PdftoppmNotFoundError } from '../lib/pdfVision';
import type { LLMContentPart } from '../lib/llmProvider';
import { extractJsonObject, extractJsonArray } from '../lib/aiJsonExtract';
import { sendServerError } from '../lib/safeError';
import { loadOcrSettings, isOcrConfigured, ocrPages } from '../lib/ocrProvider';

export const scannedSheetRouter = Router();
scannedSheetRouter.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/** Each page is one AI call; keep sheets bounded. */
const MAX_SHEET_PAGES = 10;
const MAX_PAYEE_HINTS = 150;
/** ~80 rows × ~90 output tokens per row. */
const ESTIMATED_PAGE_OUTPUT_TOKENS = 7200;

// ── Types (mirrored in client/src/api/scannedSheetImport.ts) ────────────────

export type UncertainField = 'amount' | 'description' | 'sign' | 'date' | 'ref';
const UNCERTAIN_FIELDS = new Set<UncertainField>(['amount', 'description', 'sign', 'date', 'ref']);

export interface ScannedSheetRow {
  page: number;
  line: number;
  description: string;
  rawText: string | null;
  /** Signed integer cents: positive = money in, negative = money out. */
  amount: number;
  direction: 'in' | 'out' | 'unknown';
  /** Only when a date is actually written on the line. */
  date: string | null;
  ref: string | null;
  /** Exact name from the payee hints, or null. */
  matchedPayee: string | null;
  confidence: number;
  uncertain: UncertainField[];
}

export interface ScannedSheetPage {
  page: number;
  /** data:image/jpeg;base64,… */
  imageDataUrl: string;
}

export interface ScannedSheetAnalysisResult {
  rows: ScannedSheetRow[];
  pages: ScannedSheetPage[];
  pageCount: number;
  processedPages: number;
  sheetDate: string;
  warnings: string[];
  visionMode: boolean;
  ocrMode: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 10^13 cents (= $100 billion) — anything larger is a hallucination, not a line item. */
const MAX_CENTS = 1e13;

/** YYYY-MM-DD that is also a real calendar date (rejects 2024-13-45). */
function isRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Same masking as the bank-statement route: keep the last 4 digits of anything that looks like an account number. */
function maskAccountNumbers(text: string): string {
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

async function loadPayeeHints(clientId: number): Promise<string[]> {
  const rows = (await db('bank_transactions')
    .where({ client_id: clientId })
    .whereNotNull('description')
    .groupBy('description')
    .select('description')
    .count<{ description: string; count: string }[]>({ count: '*' })
    .orderBy('count', 'desc')
    .limit(MAX_PAYEE_HINTS)) as Array<{ description: string }>;
  const patterns = (await db('classification_rules')
    .where({ client_id: clientId })
    .pluck('payee_pattern')) as string[];

  const seen = new Set<string>();
  const hints: string[] = [];
  for (const raw of [...rows.map((r) => r.description), ...patterns]) {
    const name = String(raw ?? '').trim().slice(0, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    hints.push(name);
    if (hints.length >= MAX_PAYEE_HINTS) break;
  }
  return hints;
}

// ── Prompt ───────────────────────────────────────────────────────────────────

const JSON_EXAMPLE = (page: number) => `{
  "rows": [
    {
      "page": ${page},
      "line": 1,
      "description": "Lowes shop supp",
      "rawText": "ck 1042 Lowes shop supp 84.12",
      "amount": -8412,
      "direction": "out",
      "date": null,
      "ref": "1042",
      "matchedPayee": "Lowe's",
      "confidence": 0.85,
      "uncertain": []
    }
  ],
  "warnings": []
}`;

const RULES = `Rules:
- amount: integer CENTS, signed. Money IN (deposits, sales, income, refunds received) is POSITIVE; money OUT (payments, purchases, checks, expenses) is NEGATIVE.
- direction: "in" or "out". Decide from the sheet's own cues in this priority: separate columns (e.g. Deposits / Payments, Debit / Credit, In / Out), section headings, words like "dep", "deposit", "sale", "income", "refund" (in) or "paid", "ck", "check", "bill", "purchase" (out), a leading "+" or "-", or parentheses. If there is truly no cue, assume "out" (payment), set direction to "unknown", add "sign" to uncertain, and cap confidence at 0.6.
- Never guess digits: if any part of the amount is illegible, give your best reading, add "amount" to uncertain and set confidence below 0.5. If a description is illegible, transcribe what you can and add "description" to uncertain.
- description: transcribe EXACTLY what is written for that line, minus the amount — same wording, spelling, abbreviations and capitalization (only collapse stray spaces). Do not correct spelling, expand abbreviations, or replace it with a payee name; the bookkeeper wants the client's own words.
- matchedPayee: the single best match from the known-payee list above, copied EXACTLY, or null if none clearly matches.
- ref: check number or reference if written (e.g. "ck 1042" -> "1042"), else null.
- line: 1-based position of the row on this page, top to bottom (left column before right column if there are two columns).
- Skip page headings, column headers, "total"/"subtotal"/"balance" lines, running balances, blank lines, and lines that only carry a date.
- confidence: 0-1 for the row as a whole (1 = every field clearly legible and sign certain).
- warnings: page-level notes only (e.g. "bottom third of page is cut off", "two columns; right column may be deposits").`;

function contextBlock(sheetDate: string, hints: string[]): string {
  const hintText = hints.length > 0 ? hints.map((h) => `  - ${h}`).join('\n') : '  (none)';
  return `Context:
- Sheet date: ${sheetDate}. Most lines have no date; do NOT invent one. Only fill "date" when a date is actually written on that line (use the sheet date's year to complete partial dates like "3/14").
- Known payees for this business (use ONLY to fill "matchedPayee" — the description must still be transcribed as written):
${hintText}`;
}

function buildVisionPrompt(page: number, total: number, sheetDate: string, hints: string[]): string {
  return `You are a bookkeeper's assistant. This image is page ${page} of ${total} of a HANDWRITTEN (or typed) sheet a small-business client prepared listing money in and money out. Each line normally has a description and an amount. Transcribe EVERY line item on this page.

${contextBlock(sheetDate, hints)}

Return ONLY a valid JSON object (no prose, no markdown fences, no code blocks):
${JSON_EXAMPLE(page)}

${RULES}`;
}

function buildTextPrompt(text: string, page: number, total: number, sheetDate: string, hints: string[], viaOcr: boolean): string {
  const source = viaOcr
    ? 'The text below was produced by OCR from a scanned page — spacing and column alignment may be irregular, and some characters may be misread.'
    : 'The text below was extracted from the PDF text layer.';
  return `You are a bookkeeper's assistant. This is page ${page} of ${total} of a sheet a small-business client prepared listing money in and money out. Each line normally has a description and an amount. Transcribe EVERY line item on this page. ${source}

${contextBlock(sheetDate, hints)}

SHEET TEXT (page ${page} of ${total}):
\`\`\`
${maskAccountNumbers(text)}
\`\`\`

Return ONLY a valid JSON object (no prose, no markdown fences, no code blocks):
${JSON_EXAMPLE(page)}

${RULES}`;
}

// ── Sanitizer (trust boundary for model output) ──────────────────────────────

function sanitizeRows(raw: unknown, page: number, hintSet: Set<string>): ScannedSheetRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ScannedSheetRow[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const r = item as Record<string, unknown>;
    const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

    const description = str(r.description);
    // Accept numbers or numeric strings; clamp to a sane cents magnitude so a
    // hallucinated 1e300 can't blow up the BIGINT insert later.
    const amountNum = typeof r.amount === 'number' ? r.amount : typeof r.amount === 'string' ? Number(r.amount.replace(/[,$\s]/g, '')) : NaN;
    const amountRaw = Number.isFinite(amountNum) ? Math.max(-MAX_CENTS, Math.min(MAX_CENTS, Math.round(amountNum))) : 0;
    if (!description && amountRaw === 0) return;

    const uncertain = new Set<UncertainField>(
      Array.isArray(r.uncertain) ? (r.uncertain.filter((u) => UNCERTAIN_FIELDS.has(u as UncertainField)) as UncertainField[]) : [],
    );
    // Direction is authoritative for the sign. If the model omitted/misspelt it,
    // fall back to the sign it gave the amount (positive = in) before assuming a payment.
    let direction: ScannedSheetRow['direction'];
    if (r.direction === 'in' || r.direction === 'out' || r.direction === 'unknown') direction = r.direction;
    else if (amountRaw > 0) direction = 'in';
    else if (amountRaw < 0) direction = 'out';
    else direction = 'unknown';
    const magnitude = Math.abs(amountRaw);
    let amount = magnitude;
    if (direction === 'in') amount = magnitude;
    else if (direction === 'out') amount = -magnitude;
    else { amount = -magnitude; uncertain.add('sign'); }
    if (magnitude === 0) uncertain.add('amount');

    let confidence = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? r.confidence : 0.5;
    confidence = Math.min(1, Math.max(0, confidence));
    if (direction === 'unknown') confidence = Math.min(confidence, 0.6);

    const dateStr = str(r.date, 10);
    const matched = str(r.matchedPayee, 80);
    const lineNum = typeof r.line === 'number' && Number.isFinite(r.line) && r.line > 0 ? Math.round(r.line) : idx + 1;

    out.push({
      page,
      line: lineNum,
      description,
      rawText: str(r.rawText, 300) || null,
      amount,
      direction,
      date: isRealIsoDate(dateStr) ? dateStr : null,
      ref: str(r.ref, 40) || null,
      matchedPayee: matched && hintSet.has(matched) ? matched : null,
      confidence,
      uncertain: [...uncertain],
    });
  });
  return out;
}

// ── POST /analyze ────────────────────────────────────────────────────────────

interface PageInput {
  page: number;
  image?: string; // base64 PNG for the vision model
  text?: string;  // OCR / text-layer text
}

scannedSheetRouter.post(
  '/analyze',
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ data: null, error: { code: 'NO_FILE', message: 'No file uploaded' } });
        return;
      }
      const clientId = Number(req.body.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'clientId is required' } });
        return;
      }
      // Phone photos and other non-PDFs are the likely mistake here — say so
      // instead of letting pdftoppm fail with a 500.
      if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        res.status(400).json({ data: null, error: { code: 'INVALID_FILE', message: 'Please upload a PDF. Photos (JPG/PNG) are not supported yet — scan or print the sheet to PDF first.' } });
        return;
      }
      const sheetDate = typeof req.body.sheetDate === 'string' && req.body.sheetDate ? req.body.sheetDate : todayIso();
      if (!ISO_DATE.test(sheetDate)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'sheetDate must be YYYY-MM-DD' } });
        return;
      }
      const wantHints = req.body.payeeHints !== 'false';
      const warnings: string[] = [];

      // Text layer + page count (pdf-parse can fail on some scans → treat as scanned).
      let extractedText = '';
      let textLength = 0;
      let numPages = 0;
      try {
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text ?? '';
        textLength = extractedText.replace(/\s/g, '').length;
        numPages = pdfData.numpages ?? 0;
      } catch {
        textLength = 0;
      }
      const { provider, primaryModel, vision } = await getLLMProvider();
      const tokenSettings = await getAiTokenSettings();
      const hints = wantHints ? await loadPayeeHints(clientId) : [];
      const hintSet = new Set(hints);

      // ── Render pages (model-quality PNG + lightweight JPEG previews) ──────
      let aiImages: string[] = [];
      let previewImages: string[] = [];
      let popplerMissing = false;
      try {
        aiImages = await renderPdfToImages(req.file.buffer, MAX_SHEET_PAGES, { dpi: 150, format: 'png' });
      } catch (err) {
        if (err instanceof PdftoppmNotFoundError) {
          popplerMissing = true;
        } else if (textLength < 100) {
          // Poppler is present but couldn't render it and there's no text layer:
          // a damaged / encrypted / non-PDF file, not a server fault.
          console.warn('[scanned-sheet] pdftoppm failed:', err instanceof Error ? err.message : String(err));
          res.status(422).json({ data: null, error: { code: 'UNREADABLE_PDF', message: 'This PDF could not be rendered. It may be damaged, password-protected, or not a real PDF — try re-scanning or re-saving it.' } });
          return;
        } else {
          console.warn('[scanned-sheet] pdftoppm failed, using text layer:', err instanceof Error ? err.message : String(err));
        }
      }
      if (aiImages.length > 0) {
        // Previews are optional — never let them sink the request.
        try {
          previewImages = await renderPdfToImages(req.file.buffer, MAX_SHEET_PAGES, { dpi: 100, format: 'jpeg', jpegQuality: 75 });
        } catch (err) {
          console.warn('[scanned-sheet] preview render failed:', err instanceof Error ? err.message : String(err));
          warnings.push('Page previews could not be generated — compare against your original.');
        }
      }
      if (numPages === 0 && aiImages.length === MAX_SHEET_PAGES) {
        warnings.push(`Only the first ${MAX_SHEET_PAGES} pages were processed. If the sheet is longer, split the PDF to import the rest.`);
      }

      // ── Optional OCR pre-pass ─────────────────────────────────────────────
      const ocrSettings = await loadOcrSettings();
      const requestOcr = req.body.useOcr === 'true' && isOcrConfigured(ocrSettings);
      let ocrTexts: string[] | null = null;
      if (requestOcr && aiImages.length > 0) {
        try {
          console.log(`[scanned-sheet] OCR: processing ${aiImages.length} pages via ${ocrSettings.model}`);
          const ocrResult = await ocrPages(ocrSettings, aiImages);
          logAiUsage({ endpoint: 'scanned-sheet/analyze-ocr', model: ocrSettings.model, inputTokens: ocrResult.totalInputTokens, outputTokens: ocrResult.totalOutputTokens, userId: req.user?.userId, clientId });
          warnings.push(...ocrResult.warnings);
          const usable = ocrResult.texts.filter((t) => t.replace(/\s/g, '').length >= 20).length;
          if (usable === 0) {
            warnings.push('OCR produced very little text. Falling back to standard extraction.');
          } else {
            ocrTexts = ocrResult.texts;
          }
        } catch (ocrErr) {
          console.warn('[scanned-sheet] OCR failed, falling back to standard flow:', ocrErr instanceof Error ? ocrErr.message : String(ocrErr));
          warnings.push('OCR pre-processing failed. Falling back to standard extraction.');
        }
      } else if (req.body.useOcr === 'true' && popplerMissing) {
        warnings.push('OCR requires poppler-utils on the server to render pages; skipped.');
      }

      // ── Choose the input per page ─────────────────────────────────────────
      const canVision = !popplerMissing && aiImages.length > 0 && vision.provider.supportsVision;
      let pageInputs: PageInput[] = [];
      let visionMode = false;
      let ocrMode = false;
      let textLayerMode = false;

      if (ocrTexts) {
        // OCR text where usable; vision (if available) for pages OCR couldn't read.
        ocrMode = true;
        pageInputs = ocrTexts.map((t, i) => {
          if (t.replace(/\s/g, '').length >= 20) return { page: i + 1, text: t };
          if (canVision) { visionMode = true; return { page: i + 1, image: aiImages[i] }; }
          if (!warnings.some((w) => w.startsWith(`Page ${i + 1}:`))) warnings.push(`Page ${i + 1}: OCR could not read this page.`);
          return { page: i + 1 };
        }).filter((p) => p.text !== undefined || p.image !== undefined);
      } else if (canVision) {
        visionMode = true;
        pageInputs = aiImages.map((img, i) => ({ page: i + 1, image: img }));
      } else if (textLength >= 100) {
        // Text-layer PDF (or no poppler / no vision): one call over the whole
        // text. Rows all report page 1; previews are still returned if we have
        // them so the reviewer can see the document.
        textLayerMode = true;
        pageInputs = [{ page: 1, text: extractedText }];
        if (previewImages.length === 0) {
          warnings.push(popplerMissing
            ? 'No page preview available — poppler-utils is not installed on the server; the PDF text layer was used.'
            : 'No page preview available — the PDF text layer was used.');
        } else {
          warnings.push('The PDF text layer was used (no vision model available), so rows are not tied to individual pages.');
        }
      } else {
        res.status(422).json({
          data: null,
          error: {
            code: 'SCANNED_PDF',
            message: popplerMissing
              ? 'Scanned PDF detected. Install poppler-utils on the server (sudo apt install poppler-utils) to enable vision-mode import, or enable OCR pre-processing.'
              : 'This PDF appears to be scanned (no text layer). Configure a vision-capable provider (Claude, OpenAI, or an Ollama vision model) in Settings > AI Provider > Vision Processing, or enable OCR pre-processing.',
          },
        });
        return;
      }

      if (!textLayerMode && numPages > MAX_SHEET_PAGES) {
        warnings.push(`Only the first ${MAX_SHEET_PAGES} of ${numPages} pages were processed. Split the PDF to import the rest.`);
      }

      // ── One AI call per page ──────────────────────────────────────────────
      const total = pageInputs.length;
      /** Warning prefix: per page normally, none when the whole text layer went in one call. */
      const label = (page: number) => (textLayerMode ? '' : `Page ${page}: `);
      const tokensFor = (input: PageInput): number => {
        // Per page ~80 rows; for a whole-document text call scale with its length (~40 chars/line, ~90 tokens/row).
        const estimate = input.text !== undefined && textLayerMode
          ? Math.max(ESTIMATED_PAGE_OUTPUT_TOKENS, Math.ceil(input.text.length / 40) * 90)
          : ESTIMATED_PAGE_OUTPUT_TOKENS;
        return Math.min(tokenSettings.maxTokensBankStatement, Math.max(tokenSettings.maxTokensDefault, estimate));
      };
      const rows: ScannedSheetRow[] = [];
      let failed = 0;

      for (const input of pageInputs) {
        const useImage = input.image !== undefined;
        const [aiProvider, aiModel] = useImage ? [vision.provider, vision.model] : [provider, primaryModel];
        const content: string | LLMContentPart[] = useImage
          ? [
              { type: 'image' as const, base64: input.image!, mimeType: 'image/png' as const },
              { type: 'text' as const, text: buildVisionPrompt(input.page, total, sheetDate, hints) },
            ]
          : buildTextPrompt(input.text ?? '', input.page, total, sheetDate, hints, ocrMode);

        try {
          const { result, logId } = await aiComplete(
            aiProvider,
            { model: aiModel, taskClass: TB_TASK_CLASSES.SCANNED_SHEET_EXTRACT, maxTokens: tokensFor(input), messages: [{ role: 'user', content }] },
            { endpoint: 'scanned-sheet/analyze', userId: req.user?.userId, userRole: req.user?.role, clientId },
          );
          const parsed = extractJsonObject<{ rows?: unknown; warnings?: unknown }>(result.text);
          if (!parsed) {
            const detail = `finish=${result.stopReason ?? 'unknown'}, text[0..300]=${JSON.stringify(result.text.slice(0, 300))}`;
            console.error(`[scanned-sheet] page ${input.page}: unparseable AI response: ${detail}`);
            markAiUsageParseError(logId, `Invalid JSON. ${detail}`);
            warnings.push(`${label(input.page)}the AI returned an unreadable response — re-run or enter it manually.`);
            failed++;
            continue;
          }
          if (result.stopReason === 'max_tokens' || result.stopReason === 'length') {
            warnings.push(`${label(input.page)}output was truncated — some rows near the bottom may be missing.`);
          }
          rows.push(...sanitizeRows(parsed.rows, input.page, hintSet));
          if (Array.isArray(parsed.warnings)) {
            for (const w of parsed.warnings) if (typeof w === 'string' && w.trim()) warnings.push(`${label(input.page)}${w.trim().slice(0, 300)}`);
          }
        } catch (err) {
          console.error(`[scanned-sheet] page ${input.page}: extraction failed:`, err instanceof Error ? err.message : String(err));
          warnings.push(`${label(input.page)}extraction failed.`);
          failed++;
        }
      }

      if (total > 0 && failed === total) {
        res.status(500).json({ data: null, error: { code: 'AI_ERROR', message: 'The AI could not read any page of this sheet. Please try again or check the AI provider settings.' } });
        return;
      }

      const data: ScannedSheetAnalysisResult = {
        rows,
        pages: previewImages.map((b64, i) => ({ page: i + 1, imageDataUrl: `data:image/jpeg;base64,${b64}` })),
        pageCount: numPages || (textLayerMode ? 1 : total),
        processedPages: textLayerMode ? (numPages || 1) : total,
        sheetDate,
        warnings,
        visionMode,
        ocrMode,
      };
      res.json({ data, error: null });
    } catch (err: unknown) {
      sendServerError(res, err, 'scanned-sheet');
    }
  },
);

// ── POST /categorize ─────────────────────────────────────────────────────────
// Second pass: suggest a GL account for each extracted row. Same prompt shape
// and task class as bank-transactions/ai-classify so suggestions are consistent
// with the rest of the app. Nothing is written — the dialog shows the
// suggestions and the register's Save persists whatever the user keeps.

const categorizeSchema = z.object({
  clientId: z.number().int().positive(),
  rows: z.array(z.object({
    key: z.number().int(),
    payee: z.string().max(200),
    description: z.string().max(300).optional().default(''),
    /** Signed cents: + money in, − money out. */
    amount: z.number().int(),
    date: z.string().max(10).optional().default(''),
  })).min(1).max(100),
});

export interface CategorySuggestion {
  key: number;
  accountId: number;
  confidence: number;
  reasoning: string;
}

scannedSheetRouter.post('/categorize', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = categorizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }
  const { clientId, rows } = parsed.data;
  try {
    const accounts = (await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('id', 'account_number', 'account_name', 'category')
      .orderBy('account_number')) as Array<{ id: number; account_number: string; account_name: string; category: string }>;
    if (accounts.length === 0) {
      res.json({ data: { suggestions: [] as CategorySuggestion[] }, error: null });
      return;
    }
    const rules = (await db('classification_rules as r')
      .join('chart_of_accounts as c', 'r.account_id', 'c.id')
      .where('r.client_id', clientId)
      .select('r.payee_pattern', 'c.account_number', 'c.account_name', 'r.times_confirmed')
      .orderBy('r.times_confirmed', 'desc')
      .limit(50)) as Array<{ payee_pattern: string; account_number: string; account_name: string }>;

    const coaList = accounts.map((a) => `ID:${a.id} | ${a.account_number} - ${a.account_name} (${a.category})`).join('\n');
    const rulesList = rules.length > 0
      ? rules.map((r) => `"${r.payee_pattern}" → ${r.account_number} ${r.account_name}`).join('\n')
      : 'None yet';
    const txList = rows.map((r) => {
      const dollars = Math.abs(r.amount) / 100;
      const flow = r.amount >= 0 ? 'MONEY IN' : 'MONEY OUT';
      const desc = r.description && r.description !== r.payee ? ` | note: ${r.description}` : '';
      return `KEY:${r.key} | ${r.date || 'n/a'} | ${r.payee || '(no payee)'}${desc} | ${flow} $${dollars.toFixed(2)}`;
    }).join('\n');

    const prompt = `You are an accounting assistant. A small-business client wrote these line items on a sheet by hand; the bookkeeper transcribed them. Classify each line to the single most appropriate GL account.

Sign convention: MONEY IN = deposit / income into the bank account, MONEY OUT = payment / expense.

CHART OF ACCOUNTS:
${coaList}

EXISTING CLASSIFICATION RULES (use these as strong hints — the payee text may be a misspelling or abbreviation of a rule's payee):
${rulesList}

LINE ITEMS TO CLASSIFY:
${txList}

Respond with a JSON array and nothing else. Each element: { "key": number, "accountId": number, "confidence": 0.0-1.0, "reasoning": string }. Use the KEY values exactly. If nothing fits, use your best guess with confidence below 0.4.`;

    const { provider, fastModel } = await getLLMProvider();
    const { result: aiResult, logId } = await aiComplete(
      provider,
      { model: fastModel, taskClass: TB_TASK_CLASSES.SCANNED_SHEET_CLASSIFY, maxTokens: 8192, messages: [{ role: 'user', content: prompt }] },
      { endpoint: 'scanned-sheet/categorize', userId: req.user?.userId, userRole: req.user?.role, clientId },
    );
    const raw = extractJsonArray<Record<string, unknown>>(aiResult.text);
    if (!raw) {
      markAiUsageParseError(logId, `Invalid JSON array (finish=${aiResult.stopReason ?? 'unknown'}). text[0..500]=${JSON.stringify(aiResult.text.slice(0, 500))}`);
      res.status(500).json({ data: null, error: { code: 'AI_PARSE_ERROR', message: 'AI response did not contain a JSON array' } });
      return;
    }
    const accountIdSet = new Set(accounts.map((a) => a.id));
    const keySet = new Set(rows.map((r) => r.key));
    const suggestions: CategorySuggestion[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const key = Number(item.key);
      const accountId = Number(item.accountId);
      if (!keySet.has(key) || !accountIdSet.has(accountId)) continue;
      const conf = Number(item.confidence);
      suggestions.push({
        key,
        accountId,
        confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
        reasoning: typeof item.reasoning === 'string' ? item.reasoning.slice(0, 300) : '',
      });
    }
    res.json({ data: { suggestions }, error: null });
  } catch (err: unknown) {
    sendServerError(res, err, 'scanned-sheet');
  }
});
