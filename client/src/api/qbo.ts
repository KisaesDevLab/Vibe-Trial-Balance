// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { apiFetch, type ApiResult } from './client';
import { API_BASE_URL } from '../lib/baseConfig';

export type QboEnvironment = 'sandbox' | 'production';

/** Send this instead of a secret to leave the stored value untouched. */
export const QBO_SECRET_KEEP = '__keep__';

export const QBO_SETUP_GUIDE_URL = `${API_BASE_URL}/integrations/qbo/setup-guide.pdf`;

export interface QboIntuitUrls {
  hostDomain: string;
  launchUrl: string;
  disconnectUrl: string;
  connectUrl: string;
  privacyPolicyUrl: string;
  eulaUrl: string;
}

export interface QboSettings {
  configured: boolean;
  envOverride: boolean;
  environment: QboEnvironment;
  clientId: string;
  hasClientSecret: boolean;
  clientSecretMasked: string;
  /** The stored override, '' when none. */
  redirectUriOverride: string;
  /** What Intuit must have registered — override when valid, else the derived default. */
  redirectUri: string;
  defaultRedirectUri: string;
  appBaseUrl: string;
  /** Every URL Intuit's production checklist asks for, derived from the effective redirect URI. */
  intuitUrls: QboIntuitUrls;
}

export interface QboSettingsPatch {
  environment: QboEnvironment;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
}

export type QboConnectionStatus = 'not_connected' | 'active' | 'needs_reauth' | 'error';

export interface QboConnectionRow {
  clientId: number;
  clientName: string;
  connectionId: number | null;
  companyName: string | null;
  realmId: string | null;
  environment: QboEnvironment | null;
  status: QboConnectionStatus;
  statusDetail: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  firstAuthorizedAt: string | null;
  lastRefreshedAt: string | null;
  lastImportAt: string | null;
  boundAt: string | null;
}

export interface QboPending {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string | null;
  realmId: string;
  environment: QboEnvironment;
  /** The company this client is currently bound to, when binding would replace it. */
  replacesCompany: string | null;
  /** Another client already bound to this company — binding will be refused. */
  boundElsewhereTo: string | null;
}

export interface QboTestResult {
  ok: boolean;
  message: string;
  companyName?: string;
  code?: string | null;
}

export function getQboSettings(): Promise<ApiResult<QboSettings>> {
  return apiFetch<QboSettings>('/integrations/qbo/settings');
}

export function saveQboSettings(patch: QboSettingsPatch): Promise<ApiResult<QboSettings>> {
  return apiFetch<QboSettings>('/integrations/qbo/settings', { method: 'PUT', body: JSON.stringify(patch) });
}

export function testQboCredentials(patch: QboSettingsPatch): Promise<ApiResult<QboTestResult>> {
  return apiFetch<QboTestResult>('/integrations/qbo/settings/test', { method: 'POST', body: JSON.stringify(patch) });
}

export function listQboConnections(): Promise<ApiResult<QboConnectionRow[]> & { meta?: { configured: boolean; environment: QboEnvironment } }> {
  return apiFetch<QboConnectionRow[]>('/integrations/qbo/connections');
}

export function startQboConnect(clientId: number): Promise<ApiResult<{ authorizeUrl: string }>> {
  return apiFetch<{ authorizeUrl: string }>('/integrations/qbo/connect', { method: 'POST', body: JSON.stringify({ clientId }) });
}

export function getQboPending(id: number): Promise<ApiResult<QboPending>> {
  return apiFetch<QboPending>(`/integrations/qbo/pending/${id}`);
}

export function bindQboPending(id: number): Promise<ApiResult<{ connectionId: number; realmChanged: boolean }>> {
  return apiFetch<{ connectionId: number; realmChanged: boolean }>(`/integrations/qbo/pending/${id}/bind`, { method: 'POST' });
}

export function discardQboPending(id: number): Promise<ApiResult<{ discarded: boolean }>> {
  return apiFetch<{ discarded: boolean }>(`/integrations/qbo/pending/${id}/discard`, { method: 'POST' });
}

export function testQboConnection(connectionId: number): Promise<ApiResult<QboTestResult>> {
  return apiFetch<QboTestResult>(`/integrations/qbo/connections/${connectionId}/test`, { method: 'POST' });
}

export function deleteQboConnection(connectionId: number): Promise<ApiResult<{ deleted: boolean; revoked: boolean }>> {
  return apiFetch<{ deleted: boolean; revoked: boolean }>(`/integrations/qbo/connections/${connectionId}`, { method: 'DELETE' });
}

// ── Import ──────────────────────────────────────────────────────────────────

export type QboAccountingMethod = 'Accrual' | 'Cash';
/** `current` → the period's unadjusted columns; `prior` → the PY Tie-Out's uploaded PY balances. */
export type QboImportTarget = 'current' | 'prior';

export interface QboPriorRange {
  startDate: string;
  endDate: string;
  /** `period` = the adjacent period's own dates; `derived` = this period's dates slid back a year. */
  source: 'period' | 'derived';
  priorPeriodId: number | null;
  priorPeriodName: string | null;
}
export type QboMatchAction = 'match' | 'create_new' | 'exception';
export type QboDecisionAction = 'match' | 'create_new' | 'skip';
export type QboExceptionReason = 'NO_ACCOUNT_ID' | 'ACCT_NUM_BOUND_ELSEWHERE' | 'DUPLICATE_ACCT_NUM';

export interface QboPreviewRow {
  rowKey: string;
  qboAccountId: string | null;
  qboName: string;
  qboFullName: string;
  qboAcctNum: string | null;
  classification: string | null;
  debitCents: number;
  creditCents: number;
  action: QboMatchAction;
  matchType: 'qbo_id' | 'acct_num' | 'qbo_name' | 'name' | null;
  matchedAccountId: number | null;
  matchedAccountNumber: string | null;
  matchedAccountName: string | null;
  writeQboId: boolean;
  newAccountNumber: string | null;
  newAccountName: string | null;
  newCategory: string | null;
  newNormalBalance: string | null;
  exceptionReason: QboExceptionReason | null;
}

export interface QboAbsentAccount {
  accountId: number;
  accountNumber: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
}

export interface QboPreviewResult {
  importId: number;
  target: QboImportTarget;
  priorRange: QboPriorRange | null;
  companyName: string;
  accountingMethod: QboAccountingMethod;
  defaultAccountingMethod: QboAccountingMethod | null;
  bookCloseDate: string | null;
  header: { reportBasis: string | null; startPeriod: string | null; endPeriod: string | null; currency: string | null; time: string | null; noReportData: boolean };
  params: { start_date: string; end_date: string; accounting_method: QboAccountingMethod };
  totals: { debitCents: number; creditCents: number; balanced: boolean; imbalanceCents: number };
  rows: QboPreviewRow[];
  absentNonzero: QboAbsentAccount[];
  warnings: string[];
  sha256: string;
}

export interface QboImportDecision {
  rowKey: string;
  action: QboDecisionAction;
  matchedAccountId?: number | null;
  newAccountNumber?: string | null;
  newAccountName?: string | null;
  newCategory?: string | null;
  newNormalBalance?: string | null;
}

export interface QboConfirmResult {
  target: QboImportTarget;
  accountsMatched: number;
  accountsCreated: number;
  rowsImported: number;
  rowsSkipped: number;
  accountsZeroed: number;
  qboIdsLinked: number;
  accountsWithoutTaxCodes: number;
  total: number;
}

export function previewQboImport(body: {
  periodId: number;
  clientId: number;
  accountingMethod?: QboAccountingMethod;
  target?: QboImportTarget;
}): Promise<ApiResult<QboPreviewResult>> {
  return apiFetch<QboPreviewResult>('/import/qbo/preview', { method: 'POST', body: JSON.stringify(body) });
}

export type QboSuggestConfidence = 'high' | 'medium' | 'low';

export interface QboMatchSuggestion {
  rowKey: string;
  accountId: number;
  accountNumber: string;
  accountName: string;
  confidence: QboSuggestConfidence;
}

export interface QboSuggestResult {
  suggestions: QboMatchSuggestion[];
  rowsConsidered: number;
  candidates: number;
}

/** Rows per request; the server runs one AI call per 40 within it. */
export const QBO_SUGGEST_CHUNK_SIZE = 80;

/** Opt-in AI pass over unresolved rows. Returns suggestions only — nothing is written. */
export function suggestQboMatches(body: { importId: number; rowKeys?: string[] }): Promise<ApiResult<QboSuggestResult>> {
  return apiFetch<QboSuggestResult>('/import/qbo/suggest-matches', { method: 'POST', body: JSON.stringify(body) });
}

export function confirmQboImport(body: {
  importId: number;
  decisions: QboImportDecision[];
  zeroAbsent: boolean;
  acknowledgeUnbalanced?: boolean;
}): Promise<ApiResult<QboConfirmResult>> {
  return apiFetch<QboConfirmResult>('/import/qbo/confirm', { method: 'POST', body: JSON.stringify(body) });
}
