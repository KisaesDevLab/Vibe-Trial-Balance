// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Accountant's report letter types (SSARS 21). Two seeded defaults exist:
// compilation (AR-C 80) and preparation (AR-C 70).

export const REPORT_LETTER_TYPES = ['compilation', 'preparation'] as const;
export type ReportLetterType = (typeof REPORT_LETTER_TYPES)[number];

/** Default report title per type (also exposed as the {{report_title}} value). */
export const REPORT_LETTER_TITLES: Record<ReportLetterType, string> = {
  compilation: "Accountant's Compilation Report",
  preparation: 'Preparation of Financial Statements',
};
