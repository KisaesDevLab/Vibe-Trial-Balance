import { Router, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAiUsage } from '../lib/aiUsage';
import { getLLMProvider } from '../lib/aiClient';
import { extractJsonObject, extractJsonArray } from '../lib/aiJsonExtract';

// ── Excel → CSV conversion ──────────────────────────────────────────────────

const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb'];

function isExcelFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return EXCEL_EXTENSIONS.includes(ext);
}

/**
 * Read an Excel buffer and convert the first worksheet to CSV text.
 * Preserves numbers as-is (no JS floating-point formatting issues) and
 * quotes fields that contain commas or quotes.
 */
async function excelBufferToCsv(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel file has no worksheets');

  // Determine the true column extent by scanning all rows.
  // sheet.columnCount and row.cellCount can both undercount in edge cases.
  let colCount = sheet.columnCount || 0;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    // row.values is 1-indexed sparse array; its length is the max col + 1
    const rowMax = Array.isArray(row.values) ? row.values.length - 1 : (row.cellCount || 0);
    if (rowMax > colCount) colCount = rowMax;
  });
  if (colCount === 0) colCount = 1;

  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let col = 1; col <= colCount; col++) {
      const cell = row.getCell(col);
      let val = '';
      if (cell.value !== null && cell.value !== undefined) {
        const v = cell.value as unknown;
        if (typeof v === 'object' && v !== null && 'result' in (v as Record<string, unknown>)) {
          // Formula cell — use the cached result
          val = String((v as { result: unknown }).result ?? '');
        } else if (v instanceof Date) {
          val = v.toISOString().slice(0, 10);
        } else {
          val = String(v);
        }
      }
      // CSV-escape
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      cells.push(val);
    }
    lines.push(cells.join(','));
  });
  return lines.join('\n');
}

export const csvImportRouter = Router();
csvImportRouter.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Types ────────────────────────────────────────────────────────────────────

export interface CsvMatchRow {
  csvRow: number;
  csvAccountNumber: string | null;
  csvAccountName: string | null;
  csvDebit: string | null;
  csvCredit: string | null;
  matchedAccountId: number | null;
  matchedAccountNumber: string | null;
  matchedAccountName: string | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'alias' | 'none';
  action: 'match' | 'create_new' | 'skip';
  debitCents: number;
  creditCents: number;
  // User-editable fields for create_new rows
  newCategory?: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  newNormalBalance?: 'debit' | 'credit';
}

export interface AiAnalysisResult {
  delimiter: string;
  hasHeaders: boolean;
  headerRow: number;
  dataStartRow: number;
  amountFormat: 'separate_dr_cr' | 'single_signed' | 'single_parentheses';
  columns: {
    accountNumber: number | null;
    accountName: number | null;
    debit: number | null;
    credit: number | null;
    amount: number | null;
  };
  rowsToSkip: number[];
  matches: CsvMatchRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAliases(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

// ── Amount parsing helpers ───────────────────────────────────────────────────

function parseAmountToCents(raw: string | null | undefined): number {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return 0;
  let s = raw.trim();
  // Handle parentheses negatives: (1,234.56) → -1234.56
  const isNeg = s.startsWith('(') && s.endsWith(')');
  if (isNeg) s = '-' + s.slice(1, -1);
  // Strip currency symbols and commas
  s = s.replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

// ── Fallback column detection (no AI) ───────────────────────────────────────

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n');
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;
  if (tabs >= commas && tabs >= semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function splitCsvRow(line: string, delimiter: string): string[] {
  // Simple CSV split respecting quoted fields
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function buildFallbackColumnDetection(lines: string[], rawCsv: string): Omit<AiAnalysisResult, 'matches'> & { matches: CsvMatchRow[] } {
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

  let accountNumberCol: number | null = null;
  let accountNameCol: number | null = null;
  let debitCol: number | null = null;
  let creditCol: number | null = null;
  let amountCol: number | null = null;

  if (looksLikeHeader) {
    firstRow.forEach((h, i) => {
      const lower = h.toLowerCase();
      if ((lower.includes('account') && lower.includes('number')) || lower === 'acct #' || lower === 'acct#' || lower === 'no.' || lower === 'number') accountNumberCol = i;
      else if (lower.includes('account') || lower === 'name' || lower === 'description') accountNameCol = i;
      else if (lower.includes('debit') || lower === 'dr') debitCol = i;
      else if (lower.includes('credit') || lower === 'cr') creditCol = i;
      else if (lower.includes('amount') || lower.includes('balance')) amountCol = i;
    });
  }

  // Defaults if detection failed
  if (accountNumberCol === null && colCount >= 1) accountNumberCol = 0;
  if (accountNameCol === null && colCount >= 2) accountNameCol = 1;

  const amountFormat: 'separate_dr_cr' | 'single_signed' | 'single_parentheses' =
    debitCol !== null && creditCol !== null ? 'separate_dr_cr' :
    amountCol !== null ? 'single_signed' : 'separate_dr_cr';

  const dataStartRow = looksLikeHeader ? 1 : 0;

  return {
    delimiter,
    hasHeaders: looksLikeHeader,
    headerRow: looksLikeHeader ? 0 : -1,
    dataStartRow,
    amountFormat,
    columns: { accountNumber: accountNumberCol, accountName: accountNameCol, debit: debitCol, credit: creditCol, amount: amountCol },
    rowsToSkip: [],
    matches: [],
  };
}

/**
 * Deterministic row parser — processes EVERY row in the file from dataStartRow
 * to EOF using the detected column mapping. No row limit, no passes.
 */
function parseAllRows(
  allLines: string[],
  columns: AiAnalysisResult['columns'],
  delimiter: string,
  dataStartRow: number,
  amountFormat: string,
  rowsToSkip: number[],
): CsvMatchRow[] {
  const skipSet = new Set(rowsToSkip);
  const matches: CsvMatchRow[] = [];

  for (let i = dataStartRow; i < allLines.length; i++) {
    if (skipSet.has(i)) continue;
    const line = allLines[i];
    if (!line.trim()) continue;
    const cells = splitCsvRow(line, delimiter);

    const csvAccountNumber = columns.accountNumber !== null ? (cells[columns.accountNumber] ?? null) : null;
    const csvAccountName = columns.accountName !== null ? (cells[columns.accountName] ?? null) : null;

    // Skip rows with no identifiable account data
    if (!csvAccountName?.trim() && !csvAccountNumber?.trim()) continue;

    let debitCents = 0;
    let creditCents = 0;

    if (amountFormat === 'separate_dr_cr') {
      debitCents = columns.debit !== null ? parseAmountToCents(cells[columns.debit]) : 0;
      creditCents = columns.credit !== null ? parseAmountToCents(cells[columns.credit]) : 0;
    } else {
      const raw = columns.amount !== null ? (cells[columns.amount] ?? '') : '';
      const amt = parseAmountToCents(raw);
      if (amt >= 0) debitCents = amt;
      else creditCents = Math.abs(amt);
    }

    matches.push({
      csvRow: i,
      csvAccountNumber,
      csvAccountName,
      csvDebit: columns.debit !== null ? (cells[columns.debit] ?? null) : null,
      csvCredit: columns.credit !== null ? (cells[columns.credit] ?? null) : null,
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

  return matches;
}

// ── POST /api/v1/import/csv/analyze ─────────────────────────────────────────

csvImportRouter.post(
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

      // Read file content — convert Excel to CSV if needed
      let rawCsv: string;
      if (isExcelFile(req.file.originalname)) {
        rawCsv = await excelBufferToCsv(req.file.buffer);
      } else {
        rawCsv = req.file.buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      }
      const allLines = rawCsv.split('\n');
      const first30Lines = allLines.slice(0, 30);

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

      const prompt = `You are an expert accountant analyzing a CSV trial balance file.

Here are the first 30 rows of the CSV:
\`\`\`
${first30Lines.join('\n')}
\`\`\`

Here is the client's chart of accounts (format: id|account_number|account_name|category|normal_balance|import_aliases):
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
- confidence: 0-1 where 1=exact account number match, 0.95=matched via import alias, 0.8=same number different name, 0.7=fuzzy name match, 0=no match
- matchType: "exact" (same account number), "alias" (matched an import alias), "fuzzy" (name/partial match), "none" (no match)
- When the CSV account name matches an entry in the import_aliases column, use matchType "alias" with confidence 0.95
- action: "match" if matched, "create_new" if no match but looks like a real account, "skip" if subtotal/header/blank
- debitCents and creditCents: the parsed amounts in integer cents (multiply dollars by 100, round to nearest cent)
- For parentheses negatives like (1,234.56): treat as credit amount 123456 cents
- rowsToSkip: row indexes (0-based from start of file) of total/subtotal/header rows that should be ignored
- Include ALL data rows up to row 30 in matches (including rows where action="skip")`;

      // ── Step 1: Detect column mapping ─────────────────────────────────────
      // AI analyzes first 30 rows to detect delimiter, columns, and format.
      // We ONLY use the AI for column detection — row parsing is deterministic.
      let columnMapping: Omit<AiAnalysisResult, 'matches'>;
      let fallbackMode = false;

      try {
        const { provider, fastModel } = await getLLMProvider();
        const aiResult = await provider.complete({
          model: fastModel,
          maxTokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });
        logAiUsage({ endpoint: 'csv/analyze', model: fastModel, inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, userId: req.user?.userId, clientId });

        const parsed = extractJsonObject<AiAnalysisResult>(aiResult.text);
        if (!parsed) throw new Error('AI returned invalid format');
        // Extract column mapping only — discard AI's matches
        columnMapping = {
          delimiter: parsed.delimiter,
          hasHeaders: parsed.hasHeaders,
          headerRow: parsed.headerRow,
          dataStartRow: parsed.dataStartRow,
          amountFormat: parsed.amountFormat,
          columns: parsed.columns,
          rowsToSkip: parsed.rowsToSkip ?? [],
        };
      } catch (_aiErr) {
        // Fallback: heuristic column detection
        fallbackMode = true;
        columnMapping = buildFallbackColumnDetection(allLines, rawCsv);
      }

      // ── Step 2: Parse EVERY row deterministically ─────────────────────────
      // Single pass from dataStartRow to EOF using detected column indices.
      // No row limit, no multi-pass — processes the entire file in one sweep.
      const allMatches = parseAllRows(
        allLines,
        columnMapping.columns,
        columnMapping.delimiter,
        columnMapping.dataStartRow,
        columnMapping.amountFormat,
        columnMapping.rowsToSkip,
      );

      console.log(`[csv/analyze] Parsed ${allMatches.length} data rows from ${allLines.length} total lines (dataStartRow=${columnMapping.dataStartRow})`);

      // ── Step 3: Match ALL rows against COA ────────────────────────────────
      for (const match of allMatches) {
        // 1. Exact account number match
        if (match.csvAccountNumber?.trim()) {
          const numMatch = (coa as CoaRow[]).find((a) => a.account_number.trim() === match.csvAccountNumber!.trim());
          if (numMatch) {
            match.matchedAccountId = numMatch.id;
            match.matchedAccountNumber = numMatch.account_number;
            match.matchedAccountName = numMatch.account_name;
            match.confidence = 1.0;
            match.matchType = 'exact';
            match.action = 'match';
            continue;
          }
        }

        if (match.csvAccountName?.trim()) {
          const matchNameLower = match.csvAccountName.trim().toLowerCase();

          // 2. Alias exact match
          const aliasMatch = (coa as CoaRow[]).find((a) =>
            parseAliases(a.import_aliases).some((alias) => alias.toLowerCase() === matchNameLower)
          );
          if (aliasMatch) {
            match.matchedAccountId = aliasMatch.id;
            match.matchedAccountNumber = aliasMatch.account_number;
            match.matchedAccountName = aliasMatch.account_name;
            match.confidence = 0.95;
            match.matchType = 'alias';
            match.action = 'match';
            continue;
          }

          // 3. Fuzzy name match
          const nameMatch = (coa as CoaRow[]).find((a) => {
            const coaLower = a.account_name.toLowerCase();
            return coaLower === matchNameLower || coaLower.includes(matchNameLower) || matchNameLower.includes(coaLower);
          });
          if (nameMatch) {
            match.matchedAccountId = nameMatch.id;
            match.matchedAccountNumber = nameMatch.account_number;
            match.matchedAccountName = nameMatch.account_name;
            match.confidence = 0.55;
            match.matchType = 'fuzzy';
            match.action = 'match';
          }
        }
      }

      const analysisResult: AiAnalysisResult = { ...columnMapping, matches: allMatches };

      res.json({
        data: {
          ...analysisResult,
          fallbackMode,
          totalRows: allLines.filter((l) => l.trim()).length,
          rawPreview: first30Lines,
        },
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
  }
);

// ── POST /api/v1/import/csv/suggest-numbers ──────────────────────────────────

csvImportRouter.post('/suggest-numbers', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientId, matches } = req.body as {
      clientId: number;
      matches: CsvMatchRow[];
    };

    if (!clientId || !Array.isArray(matches)) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'clientId and matches are required' } });
      return;
    }

    // Load existing account numbers to avoid conflicts
    const existing = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('account_number', 'account_name', 'category');
    const existingNumbers = new Set(existing.map((a: { account_number: string }) => a.account_number));

    // Only process rows that need numbers (no csvAccountNumber)
    const needNumbers = matches.filter((m) => m.action !== 'skip' && (!m.csvAccountNumber || m.csvAccountNumber.trim() === ''));

    if (needNumbers.length === 0) {
      res.json({ data: { suggestions: [] }, error: null });
      return;
    }

    const existingList = existing.map((a: { account_number: string; account_name: string; category: string }) =>
      `${a.account_number} — ${a.account_name} (${a.category})`
    ).join('\n');

    const accountList = needNumbers.map((m) =>
      `csvRow ${m.csvRow}: "${m.csvAccountName ?? 'Unknown'}"${m.newCategory ? ` [category hint: ${m.newCategory}]` : ''}`
    ).join('\n');

    const prompt = `You are an expert accountant. Assign standard chart of accounts numbers to these accounts.

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

Accounts that need numbers:
${accountList}

Assign numbers with gaps of 10-50 between consecutive entries to allow future insertions. Infer the category and normal balance from the account name if no hint is provided.

Return ONLY a valid JSON array (no prose, no markdown fences). Use the EXACT csvRow numbers shown above. Include the accountName field:
[
  { "csvRow": 0, "accountName": "Cash", "suggestedNumber": "1000", "suggestedCategory": "assets", "suggestedNormalBalance": "debit" }
]`;

    const { provider, fastModel } = await getLLMProvider();
    const aiResult2 = await provider.complete({
      model: fastModel,
      maxTokens: Math.max(2048, needNumbers.length * 150),
      messages: [{ role: 'user', content: prompt }],
    });
    logAiUsage({ endpoint: 'csv/suggest-numbers', model: fastModel, inputTokens: aiResult2.inputTokens, outputTokens: aiResult2.outputTokens, userId: req.user?.userId, clientId });

    type SuggestionRaw = { csvRow: number; accountName?: string; suggestedNumber: string; suggestedCategory: string; suggestedNormalBalance: string };
    const rawSuggestions = extractJsonArray<SuggestionRaw>(aiResult2.text);
    if (!rawSuggestions) {
      console.error('[csv/suggest-numbers] Failed to parse AI response:', aiResult2.text.slice(0, 500));
      res.status(500).json({ data: null, error: { code: 'PARSE_ERROR', message: 'AI returned unexpected format' } });
      return;
    }

    // Deduplicate: if AI produced collisions within its own suggestions, increment by 1
    // Sanitize to digits-only, max 20 chars (DB column is varchar(20))
    const usedNumbers = new Set(existingNumbers);
    const suggestions = rawSuggestions.map((s) => {
      let num = s.suggestedNumber.replace(/[^0-9]/g, '').slice(0, 20) || '9999';
      while (usedNumbers.has(num)) {
        num = String(parseInt(num, 10) + 1);
      }
      usedNumbers.add(num);
      // Match by csvRow; fall back to name matching if AI returned wrong row numbers
      const sourceMatch = needNumbers.find((m) => m.csvRow === s.csvRow)
        ?? (s.accountName ? needNumbers.find((m) => m.csvAccountName?.toLowerCase() === s.accountName!.toLowerCase()) : undefined);
      const cat = s.suggestedCategory?.toLowerCase().trim();
      const validCat = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'].includes(cat) ? cat : 'expenses';
      const nb = s.suggestedNormalBalance?.toLowerCase().trim();
      const validNb = nb === 'credit' ? 'credit' : 'debit';
      return {
        csvRow: sourceMatch?.csvRow ?? s.csvRow,
        csvAccountName: sourceMatch?.csvAccountName ?? s.accountName ?? null,
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

// ── POST /api/v1/import/csv/chat ─────────────────────────────────────────────

csvImportRouter.post('/chat', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rawPreview, analysis, messages, userMessage, clientId } = req.body as {
      rawPreview: string[];
      analysis: AiAnalysisResult & { fallbackMode?: boolean; totalRows?: number };
      messages: { role: 'user' | 'assistant'; content: string }[];
      userMessage: string;
      clientId: number;
    };

    if (!userMessage || !analysis) {
      res.status(400).json({ data: null, error: { code: 'INVALID_PARAMS', message: 'userMessage and analysis are required' } });
      return;
    }

    // Load COA for context
    const coa = await db('chart_of_accounts')
      .where({ client_id: clientId, is_active: true })
      .select('id', 'account_number', 'account_name', 'category', 'import_aliases')
      .orderBy('account_number');
    const coaSummary = coa.map((a: { id: number; account_number: string; account_name: string; category: string; import_aliases: unknown }) => {
      const aliases = parseAliases(a.import_aliases);
      const aliasStr = aliases.length > 0 ? aliases.join(',') : '';
      return `${a.id}|${a.account_number}|${a.account_name}|${a.category}|${aliasStr}`;
    }).join('\n');

    const systemPrompt = `You are an expert accountant assistant helping review a CSV trial balance import.

Raw CSV preview (first 30 rows):
\`\`\`
${(rawPreview ?? []).join('\n')}
\`\`\`

Current analysis result:
\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\`

Client's chart of accounts (id|account_number|account_name|category):
\`\`\`
${coaSummary || '(no accounts yet)'}
\`\`\`

You are in a conversation with the accountant reviewing this import. Your job is to:
1. Explain what was found in plain language
2. Answer questions about specific rows, account matching, column detection, or amounts
3. If the user asks to correct the analysis (e.g., "column 2 is the debit, not column 3" or "row 5 should be skipped"), produce a corrected analysis

Respond ONLY with a valid JSON object (no prose, no markdown fences):
{
  "reply": "your helpful response in plain text (use \\n for line breaks)",
  "revisedAnalysis": null
}

If the user requests corrections to the column mapping, account matching, or row actions, set revisedAnalysis to a complete corrected analysis object using the same structure as the current analysis. Preserve all existing matches but apply the requested corrections. Otherwise set revisedAnalysis to null.`;

    const aiMessages = [
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const { provider, fastModel } = await getLLMProvider();
    const aiResult3 = await provider.complete({
      model: fastModel,
      maxTokens: 2048,
      system: systemPrompt,
      messages: aiMessages,
    });
    logAiUsage({ endpoint: 'csv/chat', model: fastModel, inputTokens: aiResult3.inputTokens, outputTokens: aiResult3.outputTokens, userId: req.user?.userId, clientId });

    const parsed = extractJsonObject<{ reply: string; revisedAnalysis: AiAnalysisResult | null }>(aiResult3.text);
    if (!parsed) {
      res.json({ data: { reply: aiResult3.text.trim(), revisedAnalysis: null }, error: null });
      return;
    }
    res.json({ data: parsed, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// ── POST /api/v1/import/csv/confirm ─────────────────────────────────────────

csvImportRouter.post('/confirm', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { periodId, clientId, matches, aiExtraction } = req.body as {
      periodId: number;
      clientId: number;
      matches: CsvMatchRow[];
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

    // Detect account number collisions among create_new rows before starting transaction
    const createNewRows = matches.filter((m) => m.action === 'create_new' && m.csvAccountNumber?.trim());
    const seenNumbers = new Map<string, string>();
    for (const m of createNewRows) {
      const num = m.csvAccountNumber!.trim();
      if (seenNumbers.has(num)) {
        res.status(422).json({ data: null, error: { code: 'DUPLICATE_ACCOUNT_NUMBER', message: `Account number "${num}" appears more than once in the import. Each account number must be unique.` } });
        return;
      }
      seenNumbers.set(num, m.csvAccountName ?? '');
    }

    // Wrap all writes in a single transaction — all succeed or all roll back
    const stats = await db.transaction(async (trx) => {
      let accountsCreated = 0;
      let accountsMatched = 0;
      let rowsImported = 0;
      let rowsSkipped = 0;
      // Track which matched accounts need their alias list updated
      const aliasUpdates: Array<{ accountId: number; importName: string }> = [];

      for (const match of matches) {
        if (match.action === 'skip') { rowsSkipped++; continue; }

        let accountId = match.matchedAccountId;

        if (match.action === 'create_new' || (match.action === 'match' && !accountId)) {
          if (!match.csvAccountName) { rowsSkipped++; continue; }

          const rawNum = (match as { newAccountNumber?: string }).newAccountNumber?.trim() || match.csvAccountNumber?.trim() || null;
          // Sanitize: strip non-alphanumeric, enforce varchar(20) limit
          const accountNum = rawNum ? rawNum.replace(/[^a-zA-Z0-9.\-]/g, '').slice(0, 20) : null;

          // If the account number already exists in COA, use that account (implicit match)
          if (accountNum && existingByNumber.has(accountNum)) {
            accountId = existingByNumber.get(accountNum)!;
            accountsMatched++;
          } else {
            // Determine category and normal_balance
            let category: string = match.newCategory ?? 'expenses';
            let normalBalance: string = match.newNormalBalance ?? 'debit';

            if (!match.newCategory) {
              const name = (match.csvAccountName || '').toLowerCase();
              const num = accountNum ?? '';
              const numericPart = parseInt(num.replace(/\D/g, ''), 10);
              if (!isNaN(numericPart)) {
                if (numericPart < 2000) { category = 'assets'; normalBalance = 'debit'; }
                else if (numericPart < 3000) { category = 'liabilities'; normalBalance = 'credit'; }
                else if (numericPart < 4000) { category = 'equity'; normalBalance = 'credit'; }
                else if (numericPart < 5000) { category = 'revenue'; normalBalance = 'credit'; }
                else { category = 'expenses'; normalBalance = 'debit'; }
              } else {
                if (name.includes('cash') || name.includes('receivable') || name.includes('asset') || name.includes('equipment') || name.includes('inventory')) {
                  category = 'assets'; normalBalance = 'debit';
                } else if (name.includes('payable') || name.includes('liability') || name.includes('loan') || name.includes('debt')) {
                  category = 'liabilities'; normalBalance = 'credit';
                } else if (name.includes('equity') || name.includes('capital') || name.includes('retained')) {
                  category = 'equity'; normalBalance = 'credit';
                } else if (name.includes('revenue') || name.includes('income') || name.includes('sales')) {
                  category = 'revenue'; normalBalance = 'credit';
                }
              }
            }

            const finalNum = accountNum || `IMP${Date.now().toString(36).slice(-6).toUpperCase()}`;
            const [newAccount] = await trx('chart_of_accounts')
              .insert({
                client_id: clientId,
                account_number: finalNum,
                account_name: match.csvAccountName,
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
          // Queue alias update for matched rows
          if (accountId && match.csvAccountName?.trim()) {
            aliasUpdates.push({ accountId, importName: match.csvAccountName.trim() });
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
        import_type: 'csv',
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
