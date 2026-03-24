# AI Provider Configuration

## Overview
The app supports three AI providers behind a unified interface. All AI features — diagnostics, tax code auto-assignment, bank transaction classification, CSV/PDF import, and support chat — work with whichever provider is configured.

## Supported Providers

### Claude (Anthropic) — Default
Cloud-hosted, highest quality, native vision support for scanned PDFs.

- **API Key**: Set at Admin > Settings > Claude API Key
- **Models**: Configurable at Admin > Settings > AI Models
  - Fast model (default: `claude-haiku-4-5-20251001`) — used for classification, PDF extraction, diagnostics
  - Primary model (default: `claude-sonnet-4-6`) — used for support chat, complex tasks
- **Vision**: Always supported — scanned PDFs are automatically rendered to images and sent to Claude
- **Endpoint**: `https://api.anthropic.com` (managed by the Anthropic SDK)

### Ollama (Self-Hosted)
Run AI models locally or on your network. Full data privacy — nothing leaves your infrastructure.

- **Base URL**: The address of your Ollama server (e.g., `http://192.168.1.50:11434`)
- **Vision / Fast Model**: A small, fast model for classification and PDF extraction (e.g., `qwen3-vl:8b`)
- **Reasoning / Primary Model**: A larger model for support chat and complex analysis (e.g., `qwq:32b`)
- **Vision capability**: Auto-detected from model name, or manually overridden in Settings
- **Sample Ollama endpoints used by the app**:
  - `POST http://<host>:11434/v1/chat/completions` — all AI calls (OpenAI-compatible API)
  - `GET http://<host>:11434/v1/models` — list installed models (used by Settings > Refresh Models)
  - Health check: sends a 1-token completion request to the configured fast model

#### Setting up Ollama
1. Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
2. Pull your models: `ollama pull qwen3-vl:8b` and `ollama pull qwq:32b`
3. If running on a different machine, set `OLLAMA_HOST=0.0.0.0` to allow network access
4. In the app: Admin > Settings > AI Provider > select **Ollama**
5. Enter the Base URL and model names, then click **Test Connection**

### OpenAI-Compatible (vLLM, LM Studio, text-generation-inference, etc.)
Any server that implements the OpenAI chat completions API.

- **Base URL**: The server address (e.g., `http://localhost:8000`)
- **API Key**: Optional — required only if your server uses authentication
- **Primary Model**: The model name your server expects (e.g., `mistral-7b-instruct`)
- **Fast Model**: Optional separate model for cheaper/faster tasks; if blank, uses the primary model
- **Vision capability**: Auto-detected from model name, or manually overridden in Settings
- **Sample OpenAI-compat endpoints used by the app**:
  - `POST http://<host>:<port>/v1/chat/completions` — all AI calls
  - `GET http://<host>:<port>/v1/models` — list available models
  - Health check: sends a 1-token completion request to the configured model

#### Example: vLLM
```bash
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.3 \
  --port 8000
```
Then in the app: set Base URL to `http://localhost:8000`, Model to `mistralai/Mistral-7B-Instruct-v0.3`.

#### Example: LM Studio
1. Start LM Studio and load a model
2. Enable the local server (default port 1234)
3. In the app: set Base URL to `http://localhost:1234`, Model to the loaded model name

## Configuring the Provider
1. Go to **Admin > Settings**
2. In the **AI Provider** card, select your provider from the dropdown
3. Fill in the provider-specific fields (URL, models, API key)
4. Set the **Timeout** (default 120,000 ms / 2 minutes) — increase for slower local models
5. Click **Save**, then **Test Connection** to verify
6. The test sends a minimal 1-token request to confirm connectivity and model availability

## Vision Capability (Scanned PDF Support)
Vision-capable models can process scanned PDFs by converting pages to images. This is required for PDFs that have no text layer (photocopied documents, scanned pages).

- **Claude**: Always vision-capable
- **Ollama/OpenAI-compat**: Auto-detected from model name (looks for keywords like `vl`, `vision`, `llava`, `moondream`). If your model supports vision but isn't detected, set the **Vision capability** dropdown to **Enabled** in Settings.
- **Server requirement**: The server must have `poppler-utils` installed (`sudo apt install poppler-utils`) for PDF-to-image conversion. On Windows dev machines, scanned PDF import is not available.

## How the App Uses AI
Every AI call goes through the same abstraction. The provider you choose affects nothing about the user experience — only the backend processing changes:

| Feature | Model Used | What It Does |
|---------|-----------|--------------|
| AI Diagnostics | Fast | Analyzes TB for issues and flags observations |
| Tax Code Auto-Assign | Fast | Suggests tax codes for unmapped accounts |
| Bank Transaction Classification | Fast | Categorizes imported transactions by payee/amount |
| CSV Import Column Mapping | Fast | Maps CSV columns to TB fields |
| PDF Import Extraction | Fast | Extracts account data from PDF documents |
| PDF Import (Scanned) | Fast + Vision | Renders pages to images, extracts via vision |
| Support Chat | Primary | Conversational help with streaming responses |
| AI Pricing Fetch | Fast | Estimates per-model token pricing |

## Switching Providers
You can switch providers at any time in Settings. The change takes effect immediately for the next AI request. No data migration is needed — the provider abstraction handles all differences in API format, message structure, and streaming protocol.

## Data Privacy & PII Protection

The app applies privacy safeguards before sending data to any AI provider (cloud or local):

### What is NOT sent to AI
- **Client names** — removed from all AI prompts; only entity type (e.g., 1120S, 1065) is sent
- **Full bank account numbers** — masked to show only the last 4 digits (e.g., `XXXXXX7890`)
- **EIN / Tax ID numbers** — never included in AI prompts
- **User names, passwords, or email addresses** — never sent
- **Client addresses or contact information** — never sent
- **Social Security Numbers** — never sent

### What IS sent to AI (required for functionality)
- **Account names and balances** — needed for diagnostics, tax code assignment, and import matching
- **Transaction descriptions** — contain payee/merchant names; needed for AI classification accuracy
- **Entity type and activity type** — needed for correct tax code assignment
- **Uploaded file content** — CSV/PDF/Excel files are sent for AI-powered import analysis
- **Bank statement content** — text or page images sent for transaction extraction; account numbers are masked in text mode, and the AI is instructed to return only the last 4 digits

### Using a local LLM for maximum privacy
When configured with **Ollama** (self-hosted), no data leaves your network. All AI processing happens locally on your server. This is the recommended option for clients with strict data privacy requirements.

### Cloud provider data policies
- **Anthropic (Claude)**: API data is not used for model training. See Anthropic's data processing terms.
- **OpenAI-compatible**: Depends on the specific provider. Check your provider's data retention and training policies.

## Troubleshooting
- **"Ollama base URL not configured"**: Go to Settings and enter the URL
- **"Claude API key not configured"**: Add your Anthropic API key in Settings
- **Test Connection fails**: Check that the server is running and the URL is reachable from the app server
- **Scanned PDF fails with "Install poppler-utils"**: Run `sudo apt install poppler-utils` on the server
- **Vision not detected for your model**: Set the Vision capability dropdown to **Enabled** manually
- **Slow responses**: Increase the Timeout setting; local models on CPU can be significantly slower than cloud APIs
