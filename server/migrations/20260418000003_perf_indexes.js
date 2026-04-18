/**
 * Migration: Hot-path indexes flagged by the round-2 performance audit.
 *
 * Postgres does NOT auto-index foreign-key columns. Every FK in the initial
 * schema that's used in WHERE/JOIN at scale needs an explicit index.
 * Existing data volumes don't hurt yet on a Pi, but each of these queries
 * falls off a cliff as firms accumulate a year of JE/bank-tx data.
 *
 * Uses CREATE INDEX IF NOT EXISTS so the migration is safe to re-run if a
 * DBA added a subset of these indexes by hand before we shipped.
 */
exports.up = async function (knex) {
  const stmts = [
    // journal_entry_lines — every TB grid render joins against this
    'CREATE INDEX IF NOT EXISTS idx_jel_journal_entry ON journal_entry_lines(journal_entry_id)',
    'CREATE INDEX IF NOT EXISTS idx_jel_account       ON journal_entry_lines(account_id)',

    // bank_transactions — dashboard, list, payees all filter by (client, period)
    'CREATE INDEX IF NOT EXISTS idx_bt_client_period ON bank_transactions(client_id, period_id)',
    'CREATE INDEX IF NOT EXISTS idx_bt_client_date   ON bank_transactions(client_id, transaction_date DESC)',

    // trial_balance — COA delete scans by account_id
    'CREATE INDEX IF NOT EXISTS idx_tb_account ON trial_balance(account_id)',

    // support_messages — every chat resume orders by created_at under a conv filter
    'CREATE INDEX IF NOT EXISTS idx_support_msg_conv ON support_messages(conversation_id, created_at)',

    // audit_log — admin page filters by entity_type, ORDER BY created_at DESC
    'CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_log(entity_type, created_at DESC)',

    // ai_usage_log — admin AI usage dashboard filters by date and user
    'CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_log(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_ai_usage_user    ON ai_usage_log(user_id, created_at DESC)',

    // client_documents — documents page joins by client_id
    'CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id, uploaded_at DESC)',
  ];
  for (const sql of stmts) {
    await knex.raw(sql);
  }
};

exports.down = async function (knex) {
  const stmts = [
    'DROP INDEX IF EXISTS idx_jel_journal_entry',
    'DROP INDEX IF EXISTS idx_jel_account',
    'DROP INDEX IF EXISTS idx_bt_client_period',
    'DROP INDEX IF EXISTS idx_bt_client_date',
    'DROP INDEX IF EXISTS idx_tb_account',
    'DROP INDEX IF EXISTS idx_support_msg_conv',
    'DROP INDEX IF EXISTS idx_audit_entity_type',
    'DROP INDEX IF EXISTS idx_ai_usage_created',
    'DROP INDEX IF EXISTS idx_ai_usage_user',
    'DROP INDEX IF EXISTS idx_client_documents_client',
  ];
  for (const sql of stmts) {
    await knex.raw(sql);
  }
};
