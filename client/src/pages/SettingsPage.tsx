import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, saveSettings, deleteClaudeApiKey, testClaudeKey } from '../api/settings';

export function SettingsPage() {
  const qc = useQueryClient();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await getSettings();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (key: string) => saveSettings({ claudeApiKey: key }),
    onSuccess: (res) => {
      if (res.error) { setSaveError(res.error.message); return; }
      qc.invalidateQueries({ queryKey: ['settings'] });
      setApiKeyInput('');
      setShowInput(false);
      setSaveError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClaudeApiKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaveSuccess(false);
    },
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testClaudeKey();
    setTesting(false);
    if (res.data) setTestResult(res.data);
  };

  const currentKey = data?.claude_api_key;

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Settings</h2>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Claude API Key</h3>
          <p className="text-xs text-gray-500 mb-4">
            Used for AI-powered transaction classification. The key is stored on the server and never exposed in full after saving.
            If not set here, the server falls back to the <code className="bg-gray-100 px-1 rounded">ANTHROPIC_API_KEY</code> environment variable.
          </p>

          {isLoading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="space-y-3">
              {currentKey ? (
                <div className="flex items-center gap-3">
                  <code className="text-sm bg-gray-100 px-3 py-1.5 rounded font-mono text-gray-700 flex-1">
                    {currentKey.masked}
                  </code>
                  <button
                    onClick={() => { setShowInput(true); setSaveError(null); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Replace
                  </button>
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    title={testing ? 'Test in progress…' : undefined}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    {testing ? 'Testing…' : 'Test'}
                  </button>
                  <button
                    onClick={() => { if (confirm('Remove the stored API key?')) deleteMutation.mutate(); }}
                    disabled={deleteMutation.isPending}
                    title={deleteMutation.isPending ? 'Removing key…' : undefined}
                    className="px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No API key stored.</p>
              )}

              {(!currentKey || showInput) && (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-…"
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {saveError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{saveError}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!apiKeyInput.trim()) return;
                        setSaveError(null);
                        saveMutation.mutate(apiKeyInput.trim());
                      }}
                      disabled={saveMutation.isPending || !apiKeyInput.trim()}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saveMutation.isPending ? 'Saving…' : 'Save Key'}
                    </button>
                    {showInput && (
                      <button
                        onClick={() => { setShowInput(false); setApiKeyInput(''); setSaveError(null); }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">API key saved successfully.</div>
              )}

              {testResult && (
                testResult.valid ? (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">✓ API key is valid and connected to Claude.</div>
                ) : (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">✗ Invalid API key: {testResult.message ?? 'Connection failed.'}</div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
