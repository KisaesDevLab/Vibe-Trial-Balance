import { apiFetch } from './client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BackupRecord {
  id: number;
  backup_type: string;
  backup_level: string;
  client_id: number | null;
  client_name: string | null;
  period_id: number | null;
  period_name: string | null;
  filename: string;
  file_size: number | null;
  checksum: string | null;
  storage_local: string | null;
  trigger_type: string;
  status: string;
  error_message: string | null;
  record_counts: Record<string, number> | null;
  created_by: number | null;
  created_at: string;
}

export interface RestoreRecord {
  id: number;
  backup_id: number | null;
  restore_mode: string;
  target_client_id: number | null;
  target_client_name: string | null;
  new_client_id: number | null;
  id_mappings: Record<string, Record<number, number>> | null;
  status: string;
  error_message: string | null;
  restored_by: number | null;
  restored_at: string;
}

export interface BackupManifest {
  version: string;
  backupType: string;
  backupLevel: string;
  createdAt: string;
  createdBy: string;
  clientId: number | null;
  clientName: string | null;
  periodId: number | null;
  periodName: string | null;
  recordCounts: Record<string, number>;
  checksum: string;
}

export interface UploadPreview {
  tempFile: string;
  manifest: BackupManifest;
}

export interface RestoreResult {
  success: boolean;
  mode: string;
  newClientId: number | null;
  idMappings: Record<string, Record<number, number>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backup endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const createFullBackup = () =>
  apiFetch<BackupRecord>('/backup/full', { method: 'POST' });

export const createSettingsBackup = () =>
  apiFetch<BackupRecord>('/backup/settings', { method: 'POST' });

export const createClientBackup = (clientId: number) =>
  apiFetch<BackupRecord>(`/backup/client/${clientId}`, { method: 'POST' });

export const createPeriodBackup = (periodId: number) =>
  apiFetch<BackupRecord>(`/backup/period/${periodId}`, { method: 'POST' });

export const getBackupHistory = (clientId?: number) =>
  apiFetch<BackupRecord[]>(`/backup/history${clientId ? `?clientId=${clientId}` : ''}`);

export const deleteBackup = (backupId: number) =>
  apiFetch<{ deleted: boolean }>(`/backup/${backupId}`, { method: 'DELETE' });

export function getBackupDownloadUrl(backupId: number): string {
  const stored = localStorage.getItem('auth');
  const token = stored ? (JSON.parse(stored) as { state?: { token?: string } }).state?.token ?? '' : '';
  // Return a URL; the download is triggered via a link with the Authorization header workaround
  return `/api/v1/backup/${backupId}/download?token=${encodeURIComponent(token)}`;
}

export async function downloadBackup(backupId: number, filename: string): Promise<void> {
  const stored = localStorage.getItem('auth');
  const token = stored ? (JSON.parse(stored) as { state?: { token?: string } }).state?.token ?? '' : '';

  const response = await fetch(`/api/v1/backup/${backupId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Restore endpoints
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadBackupFile(file: File): Promise<{ data: UploadPreview | null; error: { code: string; message: string } | null }> {
  const stored = localStorage.getItem('auth');
  const token = stored ? (JSON.parse(stored) as { state?: { token?: string } }).state?.token ?? '' : '';

  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch('/api/v1/restore/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Cannot reach server' } };
  }

  try {
    const json = await response.json() as { data: UploadPreview | null; error: { code: string; message: string } | null };
    return json;
  } catch {
    return { data: null, error: { code: 'PARSE_ERROR', message: `Server returned status ${response.status}` } };
  }
}

export const executeRestore = (payload: {
  backupId?: number;
  tempFile?: string;
  mode: string;
  targetClientId?: number;
}) =>
  apiFetch<RestoreResult>('/restore/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getRestoreHistory = () =>
  apiFetch<RestoreRecord[]>('/restore/history');
