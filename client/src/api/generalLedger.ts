import { apiFetch } from './client';

export interface GLLine {
  entry_date: string;
  entry_number: number;
  entry_type: string;
  description: string | null;
  debit: number;
  credit: number;
}

export interface GLAccount {
  account_id: number;
  account_number: string;
  account_name: string;
  category: string;
  normal_balance: string;
  unadjusted_debit: number;
  unadjusted_credit: number;
  lines: GLLine[];
}

export const getGeneralLedger = (periodId: number) =>
  apiFetch<GLAccount[]>(`/periods/${periodId}/general-ledger`);
