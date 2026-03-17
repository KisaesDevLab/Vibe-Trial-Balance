import { apiFetch } from './client';

export interface CashFlowLineItem {
  account_id: number;
  account_number: string;
  account_name: string;
  amount: number;  // cents, positive = source, negative = use
}

export interface CashFlowStatement {
  operating: {
    netIncome: number;
    nonCashItems: CashFlowLineItem[];
    workingCapital: CashFlowLineItem[];
    total: number;
  };
  investing: {
    items: CashFlowLineItem[];
    total: number;
  };
  financing: {
    items: CashFlowLineItem[];
    total: number;
  };
  netChange: number;
  beginningCash: number;
  endingCash: number;
}

export const getCashFlow = (periodId: number) =>
  apiFetch<CashFlowStatement>(`/periods/${periodId}/cash-flow`);
