import { useAuthStore } from '../store/uiStore';

const BASE = '/api/v1/support';

function getToken(): string {
  return useAuthStore.getState().token ?? '';
}

// ---- SSE streaming chat ----

export function streamChat(
  conversationId: number | null,
  message: string,
  onDelta: (text: string) => void,
  onDone: (fullText: string, conversationId: number) => void,
  onError: (err: string) => void,
): () => void {
  let cancelled = false;
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ conversationId, message }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        useAuthStore.getState().clearAuth();
        if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
        return;
      }
      if (!response.ok) {
        onError(`HTTP ${response.status}`);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cancelled) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const raw = trimmed.slice(6).trim();
          if (!raw) continue;
          try {
            const json = JSON.parse(raw) as {
              type: string;
              text?: string;
              fullText?: string;
              conversationId?: number;
              message?: string;
            };
            if (json.type === 'delta' && json.text !== undefined) {
              onDelta(json.text);
            } else if (json.type === 'done') {
              onDone(json.fullText ?? '', json.conversationId ?? 0);
            } else if (json.type === 'error') {
              onError(json.message ?? 'Unknown error');
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err: unknown) {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onError(msg);
    }
  })();

  return () => {
    cancelled = true;
    controller.abort();
  };
}

// ---- CRUD ----

export interface Conversation {
  id: number;
  user_id: number;
  title: string | null;
  is_bookmarked: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number | string;
}

export interface SupportMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: SupportMessage[];
}

async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<{ data: T; error: null } | { data: null; error: { code: string; message: string } }> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  });
  return res.json() as Promise<{ data: T; error: null }>;
}

export async function listConversations(): Promise<Conversation[]> {
  const result = await apiFetch<Conversation[]>(`${BASE}/conversations`);
  return result.data ?? [];
}

export async function getConversation(id: number): Promise<ConversationDetail | null> {
  const result = await apiFetch<ConversationDetail>(`${BASE}/conversations/${id}`);
  return result.data ?? null;
}

export async function updateConversation(
  id: number,
  updates: { title?: string; is_bookmarked?: boolean },
): Promise<Conversation | null> {
  const result = await apiFetch<Conversation>(`${BASE}/conversations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return result.data ?? null;
}

export async function deleteConversation(id: number): Promise<boolean> {
  const result = await apiFetch<{ deleted: boolean }>(`${BASE}/conversations/${id}`, {
    method: 'DELETE',
  });
  return result.data?.deleted ?? false;
}

export async function toggleBookmark(id: number): Promise<boolean | null> {
  const result = await apiFetch<{ is_bookmarked: boolean }>(
    `${BASE}/conversations/${id}/bookmark`,
    { method: 'POST' },
  );
  return result.data?.is_bookmarked ?? null;
}
