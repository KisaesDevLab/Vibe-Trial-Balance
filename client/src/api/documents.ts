import { apiFetch } from './client';

export interface ClientDocument {
  id: number;
  client_id: number;
  filename: string;
  file_size: number;
  file_type: string;
  linked_account_id: number | null;
  linked_journal_entry_id: number | null;
  uploaded_by: number | null;
  uploaded_at: string;
  // joined fields
  account_number: string | null;
  account_name: string | null;
  je_entry_number: number | null;
  uploader_name: string | null;
}

export const listDocuments = (clientId: number) =>
  apiFetch<ClientDocument[]>(`/clients/${clientId}/documents`);

export const uploadDocument = (clientId: number, file: File): Promise<Response> => {
  const stored = localStorage.getItem('auth');
  let token: string | null = null;
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { state?: { token?: string } };
      token = parsed.state?.token ?? null;
    } catch {
      token = null;
    }
  }
  const formData = new FormData();
  formData.append('file', file);
  return fetch(`/api/v1/clients/${clientId}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
};

export const deleteDocument = (id: number) =>
  apiFetch<{ id: number }>(`/documents/${id}`, { method: 'DELETE' });

export const linkDocument = (
  id: number,
  params: { linkedAccountId?: number | null; linkedJournalEntryId?: number | null },
) =>
  apiFetch<ClientDocument>(`/documents/${id}/link`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });

export function downloadUrl(id: number): string {
  return `/api/v1/documents/${id}/download`;
}
