import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  streamChat,
  listConversations,
  getConversation,
  deleteConversation,
  toggleBookmark,
  Conversation,
  SupportMessage,
} from '../api/support';

interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export function SupportPage() {
  const qc = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['support-conversations'],
    queryFn: listConversations,
  });

  // Load an existing conversation
  const loadConversation = useCallback(async (id: number) => {
    setLoading(false);
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    setActiveConvId(id);
    setInput('');
    const detail = await getConversation(id);
    if (detail) {
      setLocalMessages(
        detail.messages.map((m: SupportMessage) => ({ role: m.role, content: m.content })),
      );
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  function startNewConversation() {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    setActiveConvId(null);
    setLocalMessages([]);
    setInput('');
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    setLocalMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLocalMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);

    let fullText = '';

    const cleanup = streamChat(
      activeConvId,
      text,
      (delta) => {
        fullText += delta;
        setLocalMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { role: 'assistant', content: fullText, streaming: true };
          }
          return updated;
        });
      },
      (_fullText, convId) => {
        if (!activeConvId) {
          setActiveConvId(convId);
        }
        setLocalMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { role: 'assistant', content: _fullText, streaming: false };
          }
          return updated;
        });
        setLoading(false);
        qc.invalidateQueries({ queryKey: ['support-conversations'] });
      },
      (err) => {
        setLocalMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { role: 'assistant', content: `Error: ${err}`, streaming: false };
          }
          return updated;
        });
        setLoading(false);
      },
    );

    cleanupRef.current = cleanup;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteConversation(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['support-conversations'] });
      if (activeConvId === id) startNewConversation();
      setDeleteConfirmId(null);
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (id: number) => toggleBookmark(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-conversations'] });
    },
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const bookmarked = conversations.filter((c) => c.is_bookmarked);
  const recent = conversations.filter((c) => !c.is_bookmarked);

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Left sidebar — conversation list */}
      <aside className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Support Chat</h2>
        </div>

        <div className="px-3 py-2">
          <button
            onClick={startNewConversation}
            className="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1">
          {bookmarked.length > 0 && (
            <>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Bookmarked
              </p>
              {bookmarked.map((c) => (
                <ConvItem
                  key={c.id}
                  conv={c}
                  active={activeConvId === c.id}
                  onSelect={() => loadConversation(c.id)}
                  onBookmark={() => bookmarkMutation.mutate(c.id)}
                  onDelete={() => setDeleteConfirmId(c.id)}
                  confirmDelete={deleteConfirmId === c.id}
                  onConfirmDelete={() => deleteMutation.mutate(c.id)}
                  onCancelDelete={() => setDeleteConfirmId(null)}
                  formatDate={formatDate}
                />
              ))}
            </>
          )}

          {recent.length > 0 && (
            <>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-2">
                Recent
              </p>
              {recent.map((c) => (
                <ConvItem
                  key={c.id}
                  conv={c}
                  active={activeConvId === c.id}
                  onSelect={() => loadConversation(c.id)}
                  onBookmark={() => bookmarkMutation.mutate(c.id)}
                  onDelete={() => setDeleteConfirmId(c.id)}
                  confirmDelete={deleteConfirmId === c.id}
                  onConfirmDelete={() => deleteMutation.mutate(c.id)}
                  onCancelDelete={() => setDeleteConfirmId(null)}
                  formatDate={formatDate}
                />
              ))}
            </>
          )}

          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6 px-2">
              No conversations yet. Start a new one above.
            </p>
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {localMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-blue-600">
                  <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">How can I help?</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
                Ask me about any feature, workflow, or troubleshooting issue in the Trial Balance App.
              </p>
            </div>
          )}

          {localMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-3 rounded-xl text-sm whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current animate-pulse rounded-sm align-middle" />
                )}
              </div>
            </div>
          ))}

          {loading && localMessages[localMessages.length - 1]?.content === '' && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-3 rounded-xl rounded-bl-none text-sm text-gray-400 dark:text-gray-500">
                <span className="inline-flex gap-1.5">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConvItemProps {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onBookmark: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  formatDate: (iso: string) => string;
}

function ConvItem({
  conv,
  active,
  onSelect,
  onBookmark,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  formatDate,
}: ConvItemProps) {
  return (
    <div
      className={`group rounded-lg px-2 py-1.5 cursor-pointer mb-0.5 ${
        active ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-xs flex-1 truncate leading-tight ${
            active ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {conv.title ?? 'Untitled'}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onBookmark(); }}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 ${conv.is_bookmarked ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500'}`}
            title={conv.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"/>
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 dark:text-gray-500 hover:text-red-500"
            title="Delete"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(conv.updated_at)}</div>

      {confirmDelete && (
        <div
          className="mt-1 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-1.5 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-red-700 dark:text-red-400 mb-1">Delete this conversation?</p>
          <div className="flex gap-1">
            <button
              onClick={onConfirmDelete}
              className="bg-red-600 text-white px-2 py-0.5 rounded text-xs hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={onCancelDelete}
              className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
