# File Import (CSV, Excel, and PDF)

## Smart File Import (AI Column Mapping)
The app can import trial balance data from CSV, Excel (.xlsx/.xls), and text files using AI column mapping.

### How It Works
1. Go to **Trial Balance** and click **Import File**
2. Upload your file (supports .xlsx, .xls, .csv, .txt, .tsv)
3. The AI analyzes the column headers and a sample of the data
4. A **column mapping panel** appears showing which CSV column maps to which TB field
5. Review the suggested mappings — most common cases are automatic
6. Correct any mismatches, then click **Import**
7. The system imports balances for accounts matching by account number

### Supported CSV Columns
The import looks for:
- **Account Number** (required): matched to your COA
- **Account Name** (optional): used if account number not found
- **Debit** and/or **Credit** (or a single **Balance** column)
- **Prior Year Debit/Credit** (optional)

### AI Data Disclosure
Before AI analysis begins, a **data disclosure popup** shows exactly what data will be sent to the AI provider:
- Uploaded file content (first 30 rows for column analysis)
- Chart of accounts data for matching

### Confirmation Dialog
Before confirming an import, you'll see a summary showing:
- Number of accounts matched
- Number of accounts not found in COA (will be skipped)
- Whether existing balances will be overwritten

### After Import
- Unmatched accounts appear in a warning list — you can manually add them to the COA and re-import
- The TB grid shows the imported balances immediately

## PDF Import (AI Extraction)
For clients who provide a printed trial balance as a PDF:

1. Go to **Trial Balance** and click **Import from PDF**
2. Upload the PDF file
3. The AI extracts account numbers, names, and balances from the PDF
4. A **preview table** shows the extracted data — review each row
5. Correct any misread values (OCR errors, formatting issues)
6. Click **Confirm Import** to load the data into the TB

### Digital PDFs (Text Layer)
PDFs with a text layer (exported from accounting software, Excel, etc.) work with all AI providers. The app extracts the text directly and sends it to the AI for structured parsing.

### Scanned PDFs (Vision Mode)
PDFs without a text layer — scanned pages, photocopies, or images — require **vision-mode** processing:

1. The app detects that the PDF has no extractable text (or very little)
2. Each page is rendered to a PNG image using `pdftoppm` (from `poppler-utils`)
3. The images are sent to the AI provider's vision endpoint
4. The AI reads the images and extracts account data just as it would from text

**Requirements for scanned PDF support:**
- **AI provider must support vision**: Claude always does. For Ollama or OpenAI-compat, use a vision-capable model (e.g., `qwen3-vl`, `llava`) and ensure the Vision capability is set to **Enabled** in Settings
- **Server must have `poppler-utils` installed**: `sudo apt install poppler-utils` on Linux. Not available on Windows dev machines.

If vision is not available, the app shows a clear error message explaining what's needed rather than failing silently.

### Verification Panel
After a PDF import, a **verification panel** appears on the Trial Balance page showing:
- Line-by-line comparison of extracted vs. system values
- Match/discrepancy indicators for each account
- The ability to re-run verification after corrections

### Best Results
- Digital PDFs give the highest accuracy with any provider
- Scanned PDFs work best with Claude or a high-quality Ollama vision model
- Simple two-column layouts (account / amount) work best
- Multi-column layouts with Dr/Cr columns are also supported
- Ensure the PDF is not password-protected
