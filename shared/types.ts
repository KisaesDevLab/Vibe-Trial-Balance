export const ENTITY_TYPES = ['1065', '1120', '1120S', '1040_C'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ACCOUNT_CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as const;
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number];

export function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function displayToCents(value: string | number): number {
  if (typeof value === 'number') return Math.round(value * 100);
  return Math.round(parseFloat(value.replace(/[^0-9.-]/g, '')) * 100);
}
