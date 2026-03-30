// SPDX-License-Identifier: BUSL-1.1
// Copyright (C) 2024–2026 Kisaes LLC

interface PiiItem {
  label: string;
  detail: string;
}

interface Props {
  feature: string;
  piiItems: PiiItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function AiConsentDialog({ feature, piiItems, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">AI Data Disclosure</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{feature}</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            The following data will be sent to the configured AI provider for processing:
          </p>
          <ul className="space-y-2">
            {piiItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 w-4 h-4 shrink-0 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-center font-bold">!</span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
            Client names and full bank account numbers are never sent. Use a local LLM (Ollama) for maximum privacy.
          </div>
        </div>
        <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirm & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PII item definitions for each AI feature.
 */
export const AI_PII = {
  diagnostics: [
    { label: 'Account names & balances', detail: 'All trial balance account names, categories, and dollar amounts for the selected period' },
    { label: 'Entity type', detail: 'Business entity type (e.g., 1120S, 1065) — client name is NOT sent' },
    { label: 'Journal entry & transaction counts', detail: 'Aggregate counts of book/tax AJEs and unclassified transactions' },
  ],
  bankClassify: [
    { label: 'Transaction descriptions', detail: 'Payee names, merchant names, and memo text from the selected bank transactions' },
    { label: 'Transaction amounts & dates', detail: 'Dollar amounts and dates for each transaction being classified' },
    { label: 'Chart of accounts', detail: 'Account numbers and names from your chart of accounts' },
  ],
  taxAutoAssign: [
    { label: 'Account names & numbers', detail: 'Account names, numbers, and categories for unmapped accounts' },
    { label: 'Entity & activity type', detail: 'Business entity type and activity type (e.g., 1120S / rental)' },
    { label: 'Available tax codes', detail: 'The list of tax codes and descriptions for the entity type' },
  ],
  csvImport: [
    { label: 'Uploaded file content', detail: 'The contents of the CSV/Excel file (first 30 rows sent for column analysis)' },
    { label: 'Chart of accounts', detail: 'Account numbers, names, and import aliases for matching' },
  ],
  pdfImport: [
    { label: 'Uploaded PDF content', detail: 'Full text or page images from the uploaded PDF document' },
    { label: 'Chart of accounts', detail: 'Account numbers, names, and import aliases for matching' },
  ],
  bankStatementPdf: [
    { label: 'Bank statement content', detail: 'Full text or page images from the bank statement — account numbers are masked to last 4 digits in text mode' },
    { label: 'Transaction details', detail: 'Dates, descriptions, amounts, check numbers, and payee names visible in the statement' },
  ],
};
