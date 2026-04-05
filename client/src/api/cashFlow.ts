// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

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
