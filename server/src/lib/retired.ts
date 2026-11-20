// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * A lead sheet or client tickmark with history in a closed period is retired
 * instead of deleted (`retired_at`). Lists, pickers, imports and new
 * placements use these; history (period views, reports) reads the tables as
 * they are.
 */
import type { Knex } from 'knex';

export function liveLeadSheets(q: Knex | Knex.Transaction, clientId: number): Knex.QueryBuilder {
  return q('lead_sheets').where({ client_id: clientId }).whereNull('retired_at');
}

export function liveTickmarks(q: Knex | Knex.Transaction, clientId: number): Knex.QueryBuilder {
  return q('tickmark_library').where({ client_id: clientId }).whereNull('retired_at');
}
