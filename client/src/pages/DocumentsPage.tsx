import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { listAccounts, type Account } from '../api/chartOfAccounts';
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  linkDocument,
  downloadUrl,
  type ClientDocument,
} from '../api/documents';
import { AccountSearchDropdown } from '../components/AccountSearchDropdown';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fileTypeLabel(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('xlsx')) return 'Excel';
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'Word';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('csv')) return 'CSV';
  if (mimeType.includes('text')) return 'Text';
  return mimeType.split('/')[1]?.toUpperCase() ?? 'File';
}

// ─── Link Modal ───────────────────────────────────────────────────────────────

interface LinkModalProps {
  doc: ClientDocument;
  accounts: Account[];
  onClose: () => void;
  onSave: (linkedAccountId: number | null, linkedJournalEntryId: number | null) => void;
  saving: boolean;
}

function LinkModal({ doc, accounts, onClose, onSave, saving }: LinkModalProps) {
  const [linkedAccountId, setLinkedAccountId] = useState<number | ''>(doc.linked_account_id ?? '');
  const [jeNumber, setJeNumber] = useState<string>(
    doc.linked_journal_entry_id != null ? String(doc.linked_journal_entry_id) : '',
  );

  const handleSave = () => {
    const acctId = linkedAccountId !== '' ? linkedAccountId : null;
    const jeId = jeNumber.trim() !== '' ? Number(jeNumber.trim()) : null;
    onSave(acctId, jeId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Link Document
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">{doc.filename}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link to Account
            </label>
            <AccountSearchDropdown
              accounts={accounts}
              value={linkedAccountId}
              onChange={setLinkedAccountId}
              placeholder="Select account (optional)..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link to Journal Entry ID
            </label>
            <input
              type="number"
              value={jeNumber}
              onChange={(e) => setJeNumber(e.target.value)}
              placeholder="JE ID (optional)..."
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

interface UploadZoneProps {
  clientId: number;
  onSuccess: () => void;
}

function UploadZone({ clientId, onSuccess }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadDocument(clientId, selectedFile);
      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } };
        setError(body.error?.message ?? 'Upload failed');
      } else {
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = '';
        onSuccess();
      }
    } catch {
      setError('Network error. Could not upload file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Upload Document</h2>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 hover:border-blue-300 hover:bg-blue-50/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        {selectedFile ? (
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">{selectedFile.name}</span>
            <span className="text-gray-400 dark:text-gray-500 ml-2">({formatBytes(selectedFile.size)})</span>
          </div>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500">
            <p>Drag and drop a file here, or click to browse</p>
            <p className="text-xs mt-1">PDF, Excel, Word, images — up to 25 MB</p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {selectedFile && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {uploading && (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <button
            onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = ''; }}
            disabled={uploading}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const { selectedClientId } = useUIStore();
  const qc = useQueryClient();
  const [linkTarget, setLinkTarget] = useState<ClientDocument | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const docsQuery = useQuery({
    queryKey: ['documents', selectedClientId],
    queryFn: () => listDocuments(selectedClientId!),
    enabled: selectedClientId != null,
  });

  const accountsQuery = useQuery({
    queryKey: ['coa', selectedClientId],
    queryFn: () => listAccounts(selectedClientId!),
    enabled: selectedClientId != null,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', selectedClientId] });
      setDeleteConfirmId(null);
    },
  });

  const handleLinkSave = async (
    linkedAccountId: number | null,
    linkedJournalEntryId: number | null,
  ) => {
    if (!linkTarget) return;
    setLinkSaving(true);
    try {
      await linkDocument(linkTarget.id, { linkedAccountId, linkedJournalEntryId });
      qc.invalidateQueries({ queryKey: ['documents', selectedClientId] });
      setLinkTarget(null);
    } finally {
      setLinkSaving(false);
    }
  };

  if (!selectedClientId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Documents</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Please select a client to manage documents.</p>
      </div>
    );
  }

  const docs = docsQuery.data?.data ?? [];
  const accounts = accountsQuery.data?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Documents</h1>

      <UploadZone
        clientId={selectedClientId}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['documents', selectedClientId] })}
      />

      {docsQuery.isLoading && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading documents…</p>
      )}

      {docsQuery.isError && (
        <p className="text-sm text-red-500 dark:text-red-400">Failed to load documents.</p>
      )}

      {!docsQuery.isLoading && docs.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">No documents uploaded yet.</p>
      )}

      {docs.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400">Filename</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400">Size</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400">Linked To</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400">Uploaded</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-200 max-w-[220px] truncate" title={doc.filename}>
                    {doc.filename}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                    {fileTypeLabel(doc.file_type)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-right text-sm font-mono tabular-nums">
                    {formatBytes(doc.file_size)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">
                    {doc.linked_account_id != null && doc.account_number ? (
                      <span title={`${doc.account_number} – ${doc.account_name}`}>
                        {doc.account_number} – {doc.account_name}
                      </span>
                    ) : doc.linked_journal_entry_id != null ? (
                      <span>JE #{doc.je_entry_number ?? doc.linked_journal_entry_id}</span>
                    ) : (
                      <span className="italic text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(doc.uploaded_at)}
                    {doc.uploader_name && (
                      <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">by {doc.uploader_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Download */}
                      <a
                        href={downloadUrl(doc.id)}
                        download={doc.filename}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Download
                      </a>
                      {/* Link */}
                      <button
                        onClick={() => setLinkTarget(doc)}
                        className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                      >
                        Link
                      </button>
                      {/* Delete */}
                      {deleteConfirmId === doc.id ? (
                        <>
                          <button
                            onClick={() => deleteMutation.mutate(doc.id)}
                            disabled={deleteMutation.isPending}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleteMutation.isPending ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(doc.id)}
                          className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {linkTarget && (
        <LinkModal
          doc={linkTarget}
          accounts={accounts}
          onClose={() => setLinkTarget(null)}
          onSave={handleLinkSave}
          saving={linkSaving}
        />
      )}
    </div>
  );
}
