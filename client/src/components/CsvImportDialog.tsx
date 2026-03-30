import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import {
  analyzeCsv,
  confirmCsvImport,
  chatCsvImport,
  suggestAccountNumbers,
  type CsvMatchRow,
  type CsvAnalysisResult,
  type ChatMessage,
} from '../api/csvImport';
import { AccountSearchDropdown } from './AccountSearchDropdown';
import { AiConsentDialog, AI_PII } from './AiConsentDialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditableMatch extends CsvMatchRow {
  newCategory?: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
  newNormalBalance?: 'debit' | 'credit';
}

interface Props {
  periodId: number;
  clientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  if (cents === 0) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function confidenceBadge(match: CsvMatchRow): React.ReactNode {
  if (match.action === 'skip') {
    return <span className="text-xs text-gray-400 italic">skip</span>;
  }
  if (match.action === 'create_new') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">New</span>;
  }
  if (match.matchType === 'alias') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400" title="Matched via import alias">alias</span>;
  }
  const pct = Math.round(match.confidence * 100);
  if (match.confidence >= 0.9) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{pct}%</span>;
  }
  if (match.confidence >= 0.7) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">{pct}%</span>;
  }
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">{pct}%</span>;
}

function rowBorderClass(match: EditableMatch): string {
  if (match.action === 'skip') return 'border-l-4 border-l-gray-300 opacity-50';
  if (match.action === 'create_new') return 'border-l-4 border-l-blue-400';
  if (match.confidence >= 0.9) return 'border-l-4 border-l-green-400';
  if (match.confidence >= 0.7) return 'border-l-4 border-l-yellow-400';
  return 'border-l-4 border-l-orange-400';
}

const CATEGORIES: Array<'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses'> = [
  'assets', 'liabilities', 'equity', 'revenue', 'expenses',
];

function needsAccountNumbers(matches: CsvMatchRow[]): boolean {
  return matches.some((m) => m.action === 'create_new' && !m.csvAccountNumber?.trim());
}

function hasImportProblems(analysis: CsvAnalysisResult, matches: CsvMatchRow[]): boolean {
  if (analysis.fallbackMode) return true;
  if (analysis.columns.accountNumber === null) return true;
  const lowConf = matches.filter((m) => m.action === 'match' && m.confidence < 0.8).length;
  const unmatched = matches.filter((m) => m.action === 'create_new').length;
  return lowConf > 0 || unmatched > 3;
}

function buildInitialMessage(analysis: CsvAnalysisResult, matches: CsvMatchRow[], noAccountNumbers: boolean): string {
  const matched = matches.filter((m) => m.action === 'match' && m.confidence >= 0.8).length;
  const lowConf = matches.filter((m) => m.action === 'match' && m.confidence < 0.8);
  const createNew = matches.filter((m) => m.action === 'create_new').length;
  const skipped = matches.filter((m) => m.action === 'skip').length;

  if (analysis.fallbackMode) {
    return `I wasn't able to run AI analysis on this file and had to fall back to automatic column detection. The results may not be accurate.\n\nI found ${matches.length} rows total. Can you help me understand the file? For example:\n• Which column contains account numbers?\n• Which column has account names?\n• Are debits and credits in separate columns, or a single amount column?\n\nYou can also just continue to the preview table and correct things there manually.`;
  }

  if (noAccountNumbers) {
    const dataRows = matches.filter((m) => m.action !== 'skip').length;
    return `I analyzed your CSV and found ${dataRows} account${dataRows !== 1 ? 's' : ''}, but the file does not contain account numbers — only account names.\n\nAccount numbers are needed to create accounts in your chart of accounts. You have two options:\n\n• Have AI assign account numbers based on the account names using standard numbering conventions (1xxx assets, 2xxx liabilities, etc.)\n• Proceed without account numbers and assign them manually after import\n\nPlease choose an option below, or ask me any questions.`;
  }

  const lines: string[] = [];
  const total = matches.length - skipped;
  lines.push(`I analyzed your CSV and found ${total} data row${total !== 1 ? 's' : ''}${skipped > 0 ? ` (plus ${skipped} header/subtotal row${skipped !== 1 ? 's' : ''} I'll skip)` : ''}.`);
  lines.push('');

  if (matched > 0) lines.push(`• ${matched} account${matched !== 1 ? 's' : ''} matched your chart of accounts with high confidence`);
  if (lowConf.length > 0) lines.push(`• ${lowConf.length} account${lowConf.length !== 1 ? 's' : ''} matched with lower confidence and may need review`);
  if (createNew > 0) lines.push(`• ${createNew} account${createNew !== 1 ? 's' : ''} had no match and will be created as new`);

  if (lowConf.length > 0) {
    lines.push('');
    lines.push(`I'm less certain about ${lowConf.length > 1 ? 'these matches' : 'this match'}:`);
    lowConf.slice(0, 4).forEach((m) => {
      lines.push(`• Row ${m.csvRow + 1}: "${m.csvAccountName}" → "${m.matchedAccountName}" (${Math.round(m.confidence * 100)}% confidence)`);
    });
    if (lowConf.length > 4) lines.push(`• …and ${lowConf.length - 4} more`);
  }

  if (createNew > 3) {
    lines.push('');
    lines.push(`${createNew} unmatched accounts is more than usual. If your chart of accounts uses different account numbers than the CSV, let me know and I can try to remap them.`);
  }

  lines.push('');
  lines.push('Ask me any questions before proceeding, or click "Continue to Preview" to review and edit the table directly.');

  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CsvImportDialog({ periodId, clientId, onClose, onSuccess }: Props) {
  const [stage, setStage] = useState<'upload' | 'chat' | 'preview'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CsvAnalysisResult | null>(null);
  const [matches, setMatches] = useState<EditableMatch[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Account number state
  const [numberChoice, setNumberChoice] = useState<'pending' | 'ai' | 'manual' | null>(null);
  const [suggestingNumbers, setSuggestingNumbers] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', clientId],
    queryFn: async () => {
      const r = await listAccounts(clientId);
      return r.data ?? [];
    },
  });

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  // ── Analyze ────────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeCsv(selectedFile, periodId, clientId);
      if (result.error) { setAnalyzeError(result.error.message); return; }
      if (!result.data) { setAnalyzeError('No data returned from server'); return; }

      const newAnalysis = result.data;
      const newMatches = result.data.matches.map((m) => ({ ...m }));
      setAnalysis(newAnalysis);
      setMatches(newMatches);

      const missingNumbers = newAnalysis.columns.accountNumber === null;
      setNumberChoice(missingNumbers ? 'pending' : null);

      if (hasImportProblems(newAnalysis, newMatches)) {
        const initialMsg = buildInitialMessage(newAnalysis, newMatches, missingNumbers);
        setChatMessages([{ role: 'assistant', content: initialMsg }]);
        setChatInput('');
        setChatError(null);
        setStage('chat');
      } else {
        setStage('preview');
      }
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Chat ───────────────────────────────────────────────────────────────────

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading || !analysis) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatError(null);

    const updatedMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(updatedMessages);
    setChatLoading(true);

    try {
      const result = await chatCsvImport(
        analysis.rawPreview ?? [],
        analysis,
        chatMessages,
        userMsg,
        clientId,
      );
      if (result.error) {
        setChatError(result.error.message);
        return;
      }
      if (!result.data) return;

      const reply = result.data.reply;
      setChatMessages([...updatedMessages, { role: 'assistant', content: reply }]);

      if (result.data.revisedAnalysis) {
        const revised = result.data.revisedAnalysis;
        const prevActive = matches.filter((m) => m.action !== 'skip').length;
        const newActive = revised.matches.filter((m) => m.action !== 'skip').length;
        const dropped = prevActive - newActive;

        setAnalysis(revised);
        setMatches(revised.matches.map((m) => ({ ...m })));
        if (!needsAccountNumbers(revised.matches)) setNumberChoice(null);

        const dropWarning = dropped > 0
          ? `\n\n⚠️ Note: ${dropped} row${dropped !== 1 ? 's' : ''} were removed from the analysis. If this wasn't intended, let me know and I'll restore them.`
          : '';
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `✓ I've updated the analysis based on your corrections.${dropWarning} Click "Continue to Preview" to review the changes.` },
        ]);
      }
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Chat error');
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // ── Account number assignment ──────────────────────────────────────────────

  const handleAiAssignNumbers = async () => {
    if (!analysis) return;
    setSuggestingNumbers(true);
    setChatError(null);
    setChatMessages((prev) => [...prev, { role: 'user', content: 'Please have AI assign account numbers.' }]);
    try {
      const result = await suggestAccountNumbers(clientId, matches);
      if (result.error) { setChatError(result.error.message); return; }
      const suggestions = result.data?.suggestions ?? [];
      if (suggestions.length === 0) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: 'No accounts needed numbers assigned.' }]);
        setNumberChoice('ai');
        return;
      }
      // Apply suggestions — match by csvRow (stable) with case-insensitive name fallback
      setMatches((prev) => prev.map((m) => {
        if (m.action !== 'create_new' && m.action !== 'match') return m;
        const nameLower = m.csvAccountName?.toLowerCase() ?? '';
        const suggestion =
          suggestions.find((s) => s.csvRow === m.csvRow) ??
          (nameLower ? suggestions.find((s) => s.csvAccountName?.toLowerCase() === nameLower) : undefined);
        if (!suggestion) return m;
        return {
          ...m,
          newAccountNumber: suggestion.suggestedNumber,
          newCategory: suggestion.suggestedCategory,
          newNormalBalance: suggestion.suggestedNormalBalance,
        };
      }));
      const lines = suggestions.map((s) => `• Row ${s.csvRow + 1}: assigned ${s.suggestedNumber} (${s.suggestedCategory})`);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `I've assigned account numbers to ${suggestions.length} account${suggestions.length !== 1 ? 's' : ''}:\n\n${lines.join('\n')}\n\nYou can review and edit these in the preview table. Click "Continue to Preview" when ready.` },
      ]);
      setNumberChoice('ai');
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Failed to suggest account numbers');
    } finally {
      setSuggestingNumbers(false);
    }
  };

  const handleManualNumbers = () => {
    setNumberChoice('manual');
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: 'I will assign account numbers manually after import.' },
      { role: 'assistant', content: 'Understood. Accounts will be created without account numbers — you can assign them in the Chart of Accounts after import. Click "Continue to Preview" to review the import table.' },
    ]);
  };

  // ── Update match row ───────────────────────────────────────────────────────

  const updateMatch = (idx: number, updates: Partial<EditableMatch>) => {
    setMatches((prev) => prev.map((m, i) => i === idx ? { ...m, ...updates } : m));
  };

  const handleActionChange = (idx: number, action: EditableMatch['action']) => {
    const m = matches[idx];
    const updates: Partial<EditableMatch> = { action };
    if (action === 'match' && !m.matchedAccountId) {
      updates.matchedAccountId = null;
    }
    if (action === 'create_new') {
      updates.matchedAccountId = null;
      updates.newCategory = m.newCategory ?? 'expenses';
      updates.newNormalBalance = m.newNormalBalance ?? 'debit';
    }
    updateMatch(idx, updates);
  };

  const handleAccountSelect = (idx: number, accountId: number | '') => {
    if (accountId === '') {
      updateMatch(idx, { matchedAccountId: null, matchedAccountNumber: null, matchedAccountName: null, confidence: 0, matchType: 'none' });
    } else {
      const acct = accounts.find((a) => a.id === accountId);
      updateMatch(idx, {
        matchedAccountId: accountId,
        matchedAccountNumber: acct?.account_number ?? null,
        matchedAccountName: acct?.account_name ?? null,
        confidence: 1,
        matchType: 'exact',
      });
    }
  };

  // ── Confirm ────────────────────────────────────────────────────────────────

  const [taxCodeNote, setTaxCodeNote] = useState<string | null>(null);

  const handleConfirm = async () => {
    setConfirming(true);
    setConfirmError(null);
    setTaxCodeNote(null);
    try {
      const result = await confirmCsvImport(periodId, clientId, matches, analysis);
      if (result.error) { setConfirmError(result.error.message); return; }
      if (result.data && result.data.accountsWithoutTaxCodes > 0) {
        setTaxCodeNote(`${result.data.accountsWithoutTaxCodes} new account${result.data.accountsWithoutTaxCodes !== 1 ? 's were' : ' was'} created without a tax code. Visit Tax Mapping to assign them.`);
        setTimeout(() => onSuccess(), 3000);
      } else {
        onSuccess();
      }
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setConfirming(false);
    }
  };

  // ── Summary stats ──────────────────────────────────────────────────────────

  const matchCount = matches.filter((m) => m.action === 'match').length;
  const createCount = matches.filter((m) => m.action === 'create_new').length;
  const skipCount = matches.filter((m) => m.action === 'skip').length;
  const totalActive = matchCount + createCount;

  const activeMatches = matches.filter((m) => m.action !== 'skip');
  const totalDebit = activeMatches.reduce((s, m) => s + m.debitCents, 0);
  const totalCredit = activeMatches.reduce((s, m) => s + m.creditCents, 0);
  const isBalanced = totalDebit === totalCredit;

  // ── Render ─────────────────────────────────────────────────────────────────

  const dialogWidth =
    stage === 'preview' ? 'w-[90vw] max-w-6xl max-h-[90vh]' :
    stage === 'chat' ? 'w-full max-w-xl max-h-[80vh]' :
    'w-full max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-modal="true" className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col ${dialogWidth}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import File</h2>
            {stage === 'chat' && (
              <p className="text-xs text-amber-600 mt-0.5">AI found issues — review before importing</p>
            )}
            {stage === 'preview' && analysis?.fallbackMode && (
              <p className="text-xs text-amber-600 mt-0.5">AI analysis unavailable — using automatic column detection. Please review matches carefully.</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {/* Stage 1: Upload */}
        {stage === 'upload' && (
          <div className="p-6 space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv,.xlsx,.xls,.xlsm"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="text-3xl mb-2">&#128196;</div>
              {selectedFile ? (
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Drop a file here, or click to browse</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Supports .xlsx, .xls, .csv, .txt, .tsv</p>
                </div>
              )}
            </div>

            {analyzeError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-400">
                <strong>Error:</strong> {analyzeError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
              <button
                onClick={() => setShowConsent(true)}
                disabled={!selectedFile || analyzing}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </span>
                ) : 'Analyze'}
              </button>
            </div>
            {showConsent && (
              <AiConsentDialog
                feature="AI File Import Analysis"
                piiItems={AI_PII.csvImport}
                onCancel={() => setShowConsent(false)}
                onConfirm={() => { setShowConsent(false); handleAnalyze(); }}
              />
            )}
          </div>
        )}

        {/* Stage 2: Chat */}
        {stage === 'chat' && analysis && (
          <>
            {/* Message thread */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5 mr-2">AI</div>
                  )}
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5 mr-2">AI</div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg rounded-bl-none px-3 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Account number choice card */}
            {numberChoice === 'pending' && (
              <div className="mx-4 mb-2 border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 shrink-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2">No account numbers detected — choose how to proceed:</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAiAssignNumbers}
                    disabled={suggestingNumbers}
                    className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {suggestingNumbers ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Assigning…
                      </span>
                    ) : 'AI Assign Account Numbers'}
                  </button>
                  <button
                    onClick={handleManualNumbers}
                    disabled={suggestingNumbers}
                    className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 dark:text-gray-300"
                  >
                    I'll Assign Manually Later
                  </button>
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="border-t dark:border-gray-700 px-4 pt-3 pb-3 shrink-0 space-y-2">
              {chatError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-2 text-xs text-red-700 dark:text-red-400">{chatError}</div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Ask a question or describe a correction… (Enter to send)"
                  rows={2}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 self-end"
                >
                  Send
                </button>
              </div>
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setStage('upload')}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={() => setStage('preview')}
                  disabled={numberChoice === 'pending'}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={numberChoice === 'pending' ? 'Please choose how to handle account numbers first' : undefined}
                >
                  Continue to Preview →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Stage 3: Preview */}
        {stage === 'preview' && analysis && (
          <>
            {/* Table area */}
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800/60 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700 w-10">Row</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700 w-28">Acct #</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700">CSV Account Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700 w-28">Action</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700">Matched Account / New Fields</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700 w-16">Conf.</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700 w-28">Debit</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700 w-28">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match, idx) => (
                    <tr
                      key={idx}
                      className={`${rowBorderClass(match)} hover:bg-gray-50 dark:hover:bg-gray-700/50 ${match.action === 'skip' ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}
                    >
                      <td className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-b dark:border-gray-700">{match.csvRow + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-xs border-b dark:border-gray-700">
                        {match.action === 'create_new' ? (
                          <input
                            type="text"
                            value={match.newAccountNumber ?? match.csvAccountNumber ?? ''}
                            onChange={(e) => updateMatch(idx, { newAccountNumber: e.target.value })}
                            placeholder="e.g. 1000"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400">{match.csvAccountNumber ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 border-b dark:border-gray-700 max-w-xs truncate dark:text-gray-300">{match.csvAccountName ?? '—'}</td>
                      <td className="px-3 py-1.5 border-b dark:border-gray-700">
                        <select
                          value={match.action}
                          onChange={(e) => handleActionChange(idx, e.target.value as EditableMatch['action'])}
                          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="match">Match</option>
                          <option value="create_new">Create New</option>
                          <option value="skip">Skip</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5 border-b">
                        {match.action === 'match' && (
                          <AccountSearchDropdown
                            accounts={accounts}
                            value={match.matchedAccountId ?? ''}
                            onChange={(id) => handleAccountSelect(idx, id)}
                            placeholder="Select account…"
                            className="w-full"
                          />
                        )}
                        {match.action === 'create_new' && (
                          <div className="flex gap-2 items-center">
                            <select
                              value={match.newCategory ?? 'expenses'}
                              onChange={(e) => updateMatch(idx, { newCategory: e.target.value as EditableMatch['newCategory'] })}
                              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                              value={match.newNormalBalance ?? 'debit'}
                              onChange={(e) => updateMatch(idx, { newNormalBalance: e.target.value as 'debit' | 'credit' })}
                              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                              <option value="debit">DR</option>
                              <option value="credit">CR</option>
                            </select>
                          </div>
                        )}
                        {match.action === 'skip' && (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 border-b">{confidenceBadge(match)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums border-b">{fmtCents(match.debitCents)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums border-b">{fmtCents(match.creditCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 shrink-0">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />
                  {matchCount} matched
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />
                  {createCount} new accounts
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" />
                  {skipCount} skipped
                </span>
                <span className="text-gray-400">|</span>
                <span>{totalActive} rows to import</span>
              </div>

              {!isBalanced && totalActive > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded p-2 text-xs text-amber-700 dark:text-amber-400 mb-2">
                  ⚠️ Debits ({fmtCents(totalDebit)}) do not equal credits ({fmtCents(totalCredit)}). The trial balance is out of balance by {fmtCents(Math.abs(totalDebit - totalCredit))}.
                </div>
              )}

              {taxCodeNote && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded p-2 text-xs text-blue-700 dark:text-blue-400 mb-2">
                  ✓ Import complete. {taxCodeNote}
                </div>
              )}

              {confirmError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-2 text-sm text-red-700 dark:text-red-400 mb-3">{confirmError}</div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
                <button
                  onClick={() => setStage(chatMessages.length > 0 ? 'chat' : 'upload')}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
                >
                  Back
                </button>
                {matches.some((m) => m.action === 'create_new' && !m.newAccountNumber?.trim() && !m.csvAccountNumber?.trim()) && (
                  <button
                    onClick={handleAiAssignNumbers}
                    disabled={suggestingNumbers}
                    className="px-4 py-2 text-sm border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
                  >
                    {suggestingNumbers ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        Suggesting…
                      </span>
                    ) : 'AI Assign Account Numbers'}
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={confirming || totalActive === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming ? (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importing...
                    </span>
                  ) : `Confirm Import (${totalActive} rows)`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
