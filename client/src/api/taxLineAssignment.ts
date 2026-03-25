import { apiFetch } from './client';

export type AssignmentSource = 'existing' | 'prior_period' | 'cross_client' | 'ai' | 'unmappable';

export interface AssignmentSuggestion {
  accountId: number;
  accountNumber: string;
  accountName: string;
  category: string;
  suggestedTaxCodeId: number | null;
  suggestedTaxCode: string | null;
  suggestedDescription: string | null;
  confidence: number;
  source: AssignmentSource;
  reasoning: string;
  // Overridden by user in modal — not from server
  overrideTaxCodeId?: number | null;
  overrideTaxCode?: string | null;
  overrideDescription?: string | null;
  excluded?: boolean;
}

export interface AutoAssignResult {
  suggestions: AssignmentSuggestion[];
  totalProcessed: number;
  bySource: {
    existing: number;
    prior_period: number;
    cross_client: number;
    ai: number;
    unmappable: number;
  };
}

export interface BulkConfirmAssignment {
  accountId: number;
  taxCodeId: number | null;
  source: string;
  confidence: number;
}

export interface BulkConfirmResult {
  results: Array<{ accountId: number; success: boolean; error?: string }>;
  updated: number;
  failed: number;
}

export interface PatternResult {
  taxCodeId: number;
  taxCode: string;
  description: string;
  sortOrder: number;
  count: number;
}

export const autoAssignTaxLines = (
  clientId: number,
  options?: { accountIds?: number[]; includeAll?: boolean },
) =>
  apiFetch<AutoAssignResult>('/tax-lines/auto-assign', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      accountIds: options?.accountIds,
      includeAll: options?.includeAll,
    }),
  });

export const bulkConfirmTaxLines = (clientId: number, assignments: BulkConfirmAssignment[]) =>
  apiFetch<BulkConfirmResult>('/tax-lines/bulk-confirm', {
    method: 'PUT',
    body: JSON.stringify({ clientId, assignments }),
  });

export const getTaxLinePatterns = (accountName: string, entityType?: string) =>
  apiFetch<PatternResult[]>(
    `/tax-lines/patterns/${encodeURIComponent(accountName)}${entityType ? `?entityType=${encodeURIComponent(entityType)}` : ''}`,
  );
