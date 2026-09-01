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

### OCR Pre-processing (Optional, Admin-Configured)
For scanned PDFs — especially dense bank and credit card statements — you can route page images through a dedicated local OCR model **before** the data-extraction AI sees them. The OCR model produces raw text with preserved columns and row structure; that text is then sent to your main AI provider for structured extraction.

**When OCR pre-processing helps**
- Dense statements where vision models sometimes miss rows (100+ transactions per page)
- Scans with small fonts, faint print, or skewed pages
- When your main AI provider is text-only (no vision) but you still need to import scanned PDFs

**How to enable (admin)**
1. Go to **Admin > Settings > AI Provider** and scroll to the **OCR Pre-processing** card
2. Toggle **Enable**
3. Choose a backend:
   - **llama.cpp server** (recommended) — `llama-server` from [llama.cpp](https://github.com/ggml-org/llama.cpp), usually on port 8080
   - **Ollama (OpenAI-compatible)** — any Ollama instance with a vision model pulled, on port 11434
4. Enter the **OCR Base URL** (e.g., `http://vibe-glm-ocr:8090` for the bundled Docker service, or `http://localhost:11434` for a local Ollama)
5. Enter the **OCR Model** name (default: `glm-ocr`; other good choices: `minicpm-v`, `qwen3-vl`)
6. Click **Test OCR Connection** to verify the server responds
7. Click **Save**

Both backends speak the OpenAI `/v1/chat/completions` wire format, so a single client handles both.

**Using OCR at import time**
When OCR is configured, the PDF import dialog shows a **Use OCR pre-processing** checkbox (only for scanned / image-based PDFs). Tick it before clicking **Analyze PDF**. The import flow is:
1. `pdftoppm` renders each page to a PNG (up to 20 pages per PDF)
2. Each page is sent sequentially to the OCR server for text extraction
3. The combined OCR text replaces the normal extracted text and is sent to the main AI for structured parsing

**Performance expectations**
- OCR is CPU/GPU-bound. Expect **30–60 seconds per page** on consumer hardware
- A 10-page statement can take 5–10 minutes end to end
- GPU acceleration (CUDA, Metal, ROCm) significantly improves speed
- Processing is intentionally sequential — parallelism doesn't help and can crash the backend
- The per-page timeout defaults to 120 seconds; raise it in Settings if your model is slower

**Output sizing**
- The OCR call is capped at 16,384 completion tokens, sized to fit even a very dense credit card statement page (~120 transactions, or ~50 international transactions with FX detail lines)
- If OCR stops early (token limit reached), the import dialog surfaces a per-page warning and the page's partial text is still passed to the AI

**Fallback behavior**
- If OCR is enabled but fails for a specific request, the app falls back to the standard (non-OCR) extraction flow and surfaces a warning
- If the OCR run produces less than ~50 chars of text total, the app assumes OCR didn't work and also falls back

**Privacy note**: OCR runs entirely on the server you configure. No image data leaves your network unless you explicitly point the Base URL at a remote, non-localhost endpoint. Non-localhost URLs trigger a warning in Settings.

### Verification Panel
After a PDF import, a **verification panel** appears on the Trial Balance page showing:
- Line-by-line comparison of extracted vs. system values
- Match/discrepancy indicators for each account
- The ability to re-run verification after corrections

### Best Results
- Digital PDFs give the highest accuracy with any provider
- Scanned PDFs work best with Claude, a high-quality Ollama vision model, or OCR pre-processing via llama.cpp / Ollama feeding into a text-only provider
- Simple two-column layouts (account / amount) work best
- Multi-column layouts with Dr/Cr columns are also supported
- Ensure the PDF is not password-protected

## Account type of new accounts
When a row will create a new account, the Category and DR/CR shown in the preview are exactly what will be written. The app fills them in during analysis — from the PDF extractor's detected category when there is one, otherwise from the account number's leading digit (1 = Assets, 2 = Liabilities, 3 = Equity, 4 = Revenue, 5–9 = Expenses, for 4- and 5-digit numbering alike), and from the account name when there is no number. Change the dropdown in the preview if the guess is wrong; what you see is what gets created.
