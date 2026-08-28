// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch } from './client';

export type StorageProvider = 'local' | 'b2';

/** Send this instead of a secret to leave the stored value untouched. */
export const SECRET_KEEP = '__keep__';

export interface StorageSettings {
  provider: StorageProvider;
  prefix: string;
  b2: {
    endpoint: string;
    region: string;
    bucket: string;
    /** Secrets are never sent to the client — only whether one is stored. */
    hasKeyId: boolean;
    hasApplicationKey: boolean;
  };
  envOverride: boolean;
  configError: string | null;
  installId: string;
  lastTestedAt: string | null;
  lastTestError: string | null;
}

export interface StorageSettingsPatch {
  provider: StorageProvider;
  prefix?: string;
  b2Endpoint?: string;
  b2Region?: string;
  b2Bucket?: string;
  b2KeyId?: string;
  b2ApplicationKey?: string;
}

export interface StorageTestResult {
  ok: boolean;
  provider: StorageProvider;
  latencyMs: number;
  listed?: number;
  message?: string;
}

export interface FolderSection {
  id: number;
  name: string;
  sort_order: number;
  is_workpaper_target: boolean;
  is_default_upload: boolean;
}

export interface FolderSectionInput {
  id?: number;
  name: string;
  sortOrder: number;
  isWorkpaperTarget: boolean;
  isDefaultUpload: boolean;
}

export type LinkStatus = 'active' | 'missing' | 'conflict';

export interface ClientFolderLink {
  id: number;
  client_id: number;
  storage_backend: StorageProvider;
  storage_path: string;
  sentinel_id: string | null;
  is_legacy_layout: boolean;
  status: LinkStatus;
  last_verified_at: string | null;
}

export interface ClientLinkRow {
  client_id: number;
  client_name: string;
  link_id: number | null;
  storage_backend: StorageProvider | null;
  storage_path: string | null;
  sentinel_id: string | null;
  is_legacy_layout: boolean | null;
  status: LinkStatus | null;
  last_verified_at: string | null;
}

export interface UnboundFolder {
  path: string;
  name: string;
  hasSentinel: boolean;
  boundToClientId: number | null;
}

export interface VerifyResult {
  status: LinkStatus;
  message: string;
  rebound?: { from: string; to: string };
}

export const getStorageSettings = () => apiFetch<StorageSettings>('/storage/settings');

export const saveStorageSettings = (patch: StorageSettingsPatch) =>
  apiFetch<{ ok: true; provider: StorageProvider; configError: string | null }>('/storage/settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

export const testStorage = (patch: Partial<StorageSettingsPatch>) =>
  apiFetch<StorageTestResult>('/storage/settings/test', {
    method: 'POST',
    body: JSON.stringify(patch),
  });

export const getFolderTemplate = () => apiFetch<FolderSection[]>('/storage/folder-template');

export const saveFolderTemplate = (sections: FolderSectionInput[]) =>
  apiFetch<FolderSection[]>('/storage/folder-template', {
    method: 'PUT',
    body: JSON.stringify({ sections }),
  });

export const listClientLinks = () => apiFetch<ClientLinkRow[]>('/storage/links');

export const listUnboundFolders = () => apiFetch<UnboundFolder[]>('/storage/unbound-folders');

export const getClientLink = (clientId: number) =>
  apiFetch<{ link: ClientFolderLink | null; suggestedPath: string | null }>(`/storage/links/${clientId}`);

export const linkClientFolder = (clientId: number, storagePath: string) =>
  apiFetch<{ link: ClientFolderLink; created: boolean; idempotent: boolean }>(
    `/storage/links/${clientId}/link`,
    { method: 'POST', body: JSON.stringify({ storagePath }) },
  );

export const createClientFolder = (clientId: number, folderName?: string) =>
  apiFetch<{ link: ClientFolderLink; created: boolean }>(`/storage/links/${clientId}/create`, {
    method: 'POST',
    body: JSON.stringify(folderName ? { folderName } : {}),
  });

export const verifyClientFolder = (clientId: number) =>
  apiFetch<VerifyResult>(`/storage/links/${clientId}/verify`, { method: 'POST' });

export const unlinkClientFolder = (clientId: number) =>
  apiFetch<{ removed: number }>(`/storage/links/${clientId}`, { method: 'DELETE' });
