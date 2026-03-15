/**
 * Initial database schema for Trial Balance Application.
 *
 * All monetary values stored as BIGINT in cents (e.g., $1,234.56 = 123456).
 * Adjusted balances are NEVER stored — always computed via views/queries
 * from unadjusted balances + journal entry line sums.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ============================================================
  // USERS & AUTH
  // ============================================================

  await knex.schema.createTable('app_users', (table) => {
    table.increments('id').primary();
    table.string('username', 100).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('display_name', 255);
    table.string('role', 20).defaultTo('preparer').notNullable();
    // roles: 'admin', 'preparer', 'reviewer'
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true); // created_at, updated_at with defaults
  });

  // ============================================================
  // CLIENTS
  // ============================================================

  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('entity_type', 20).notNullable();
    // entity_type: '1065', '1120', '1120S', '1040_C'
    table.string('tax_year_end', 5);
    // tax_year_end: 'MM-DD' e.g. '12-31'
    table.string('default_tax_software', 50);
    // default_tax_software: 'ultratax', 'cch', 'lacerte', 'drake'
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // ============================================================
  // PERIODS
  // ============================================================

  await knex.schema.createTable('periods', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    table.string('period_name', 100).notNullable();
    // period_name: 'FY 2025', 'Q4 2025', etc.
    table.date('start_date');
    table.date('end_date');
    table.boolean('is_current').defaultTo(false);
    table.integer('rolled_forward_from').unsigned()
      .references('id').inTable('periods');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ============================================================
  // CHART OF ACCOUNTS
  // ============================================================

  await knex.schema.createTable('chart_of_accounts', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    table.string('account_number', 20).notNullable();
    table.string('account_name', 255).notNullable();
    table.string('category', 50).notNullable();
    // category: 'assets', 'liabilities', 'equity', 'revenue', 'expenses'
    table.string('subcategory', 100);
    table.string('normal_balance', 10).notNullable();
    // normal_balance: 'debit', 'credit'
    table.string('tax_line', 50);
    table.string('workpaper_ref', 20);
    table.text('preparer_notes');
    table.text('reviewer_notes');
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.unique(['client_id', 'account_number']);
  });

  // ============================================================
  // TRIAL BALANCE (unadjusted balances only)
  // ============================================================

  await knex.schema.createTable('trial_balance', (table) => {
    table.increments('id').primary();
    table.integer('period_id').unsigned().notNullable()
      .references('id').inTable('periods').onDelete('CASCADE');
    table.integer('account_id').unsigned().notNullable()
      .references('id').inTable('chart_of_accounts').onDelete('CASCADE');
    table.bigInteger('unadjusted_debit').defaultTo(0);
    // stored in cents
    table.bigInteger('unadjusted_credit').defaultTo(0);
    // stored in cents
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.integer('updated_by').unsigned()
      .references('id').inTable('app_users');

    table.unique(['period_id', 'account_id']);
  });

  // ============================================================
  // JOURNAL ENTRIES
  // ============================================================

  await knex.schema.createTable('journal_entries', (table) => {
    table.increments('id').primary();
    table.integer('period_id').unsigned().notNullable()
      .references('id').inTable('periods').onDelete('CASCADE');
    table.integer('entry_number').notNullable();
    table.string('entry_type', 10).notNullable();
    // entry_type: 'book', 'tax'
    table.date('entry_date').notNullable();
    table.text('description');
    table.boolean('is_recurring').defaultTo(false);
    table.integer('created_by').unsigned()
      .references('id').inTable('app_users');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('journal_entry_lines', (table) => {
    table.increments('id').primary();
    table.integer('journal_entry_id').unsigned().notNullable()
      .references('id').inTable('journal_entries').onDelete('CASCADE');
    table.integer('account_id').unsigned().notNullable()
      .references('id').inTable('chart_of_accounts');
    table.bigInteger('debit').defaultTo(0);
    // stored in cents
    table.bigInteger('credit').defaultTo(0);
    // stored in cents
  });

  // Balance constraint (debits = credits per entry) enforced in API layer,
  // not in the database. This allows the API to provide meaningful
  // validation error messages.

  // ============================================================
  // BANK TRANSACTIONS
  // ============================================================

  await knex.schema.createTable('bank_transactions', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    table.integer('period_id').unsigned()
      .references('id').inTable('periods');
    table.date('transaction_date').notNullable();
    table.string('description', 500);
    table.bigInteger('amount').notNullable();
    // stored in cents; positive = credit to bank, negative = debit to bank
    table.string('check_number', 20);
    table.integer('account_id').unsigned()
      .references('id').inTable('chart_of_accounts');
    // classified account (confirmed by user)
    table.integer('ai_suggested_account_id').unsigned()
      .references('id').inTable('chart_of_accounts');
    table.float('ai_confidence');
    table.string('classification_status', 20).defaultTo('unclassified');
    // status: 'unclassified', 'ai_suggested', 'confirmed', 'manual'
    table.integer('classified_by').unsigned()
      .references('id').inTable('app_users');
    table.timestamp('imported_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('classification_rules', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    table.string('payee_pattern', 500).notNullable();
    table.integer('account_id').unsigned().notNullable()
      .references('id').inTable('chart_of_accounts');
    table.integer('times_confirmed').defaultTo(1);
    table.timestamps(true, true);

    table.unique(['client_id', 'payee_pattern']);
  });

  // ============================================================
  // CLIENT DOCUMENTS
  // ============================================================

  await knex.schema.createTable('client_documents', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().notNullable()
      .references('id').inTable('clients').onDelete('CASCADE');
    table.string('filename', 255).notNullable();
    table.string('file_path', 500).notNullable();
    // path on Pi filesystem, outside web root
    table.integer('file_size');
    // bytes
    table.string('file_type', 50);
    // MIME type
    table.integer('linked_account_id').unsigned()
      .references('id').inTable('chart_of_accounts');
    table.integer('linked_journal_entry_id').unsigned()
      .references('id').inTable('journal_entries');
    table.integer('uploaded_by').unsigned()
      .references('id').inTable('app_users');
    table.timestamp('uploaded_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ============================================================
  // TAX LINE REFERENCE DATA
  // ============================================================

  await knex.schema.createTable('tax_line_reference', (table) => {
    table.increments('id').primary();
    table.string('entity_type', 20).notNullable();
    // '1065', '1120', '1120S', '1040_C'
    table.string('tax_software', 50).notNullable();
    // 'ultratax', 'cch', 'lacerte', 'drake'
    table.string('tax_line_code', 50).notNullable();
    table.string('tax_line_description', 255).notNullable();
    table.string('form_section', 100);
    // e.g. 'Page 1 - Income', 'Schedule K', 'Schedule L'
    table.integer('sort_order').defaultTo(0);

    table.unique(['entity_type', 'tax_software', 'tax_line_code']);
  });

  // ============================================================
  // VARIANCE NOTES (multi-period comparison)
  // ============================================================

  await knex.schema.createTable('variance_notes', (table) => {
    table.increments('id').primary();
    table.integer('account_id').unsigned().notNullable()
      .references('id').inTable('chart_of_accounts');
    table.integer('period_id').unsigned().notNullable()
      .references('id').inTable('periods');
    table.integer('compare_period_id').unsigned().notNullable()
      .references('id').inTable('periods');
    table.text('note').notNullable();
    table.integer('created_by').unsigned()
      .references('id').inTable('app_users');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.unique(['account_id', 'period_id', 'compare_period_id']);
  });

  // ============================================================
  // AUDIT LOG
  // ============================================================

  await knex.schema.createTable('audit_log', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned()
      .references('id').inTable('app_users');
    table.string('action', 50).notNullable();
    // 'create', 'update', 'delete'
    table.string('table_name', 50).notNullable();
    table.integer('record_id');
    table.jsonb('old_values');
    table.jsonb('new_values');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ============================================================
  // INDEXES
  // ============================================================

  await knex.schema.alterTable('chart_of_accounts', (table) => {
    table.index('client_id', 'idx_coa_client');
  });

  await knex.schema.alterTable('trial_balance', (table) => {
    table.index('period_id', 'idx_tb_period');
    table.index('account_id', 'idx_tb_account');
  });

  await knex.schema.alterTable('journal_entries', (table) => {
    table.index('period_id', 'idx_je_period');
  });

  await knex.schema.alterTable('journal_entry_lines', (table) => {
    table.index('journal_entry_id', 'idx_jel_entry');
    table.index('account_id', 'idx_jel_account');
  });

  await knex.schema.alterTable('bank_transactions', (table) => {
    table.index('client_id', 'idx_bt_client');
    table.index('classification_status', 'idx_bt_status');
  });

  await knex.schema.alterTable('classification_rules', (table) => {
    table.index('client_id', 'idx_cr_client');
  });

  await knex.schema.alterTable('client_documents', (table) => {
    table.index('client_id', 'idx_docs_client');
  });

  await knex.schema.alterTable('tax_line_reference', (table) => {
    table.index(['entity_type', 'tax_software'], 'idx_tlr_lookup');
  });

  await knex.schema.alterTable('audit_log', (table) => {
    table.index(['table_name', 'record_id'], 'idx_audit_table');
  });

  // ============================================================
  // ADJUSTED TRIAL BALANCE VIEW
  // ============================================================
  // Returns unadjusted + book adjustments + tax adjustments
  // per account per period. This is the primary read path for
  // the trial balance grid.

  await knex.raw(`
    CREATE VIEW v_adjusted_trial_balance AS
    SELECT
      tb.period_id,
      tb.account_id,
      coa.account_number,
      coa.account_name,
      coa.category,
      coa.subcategory,
      coa.normal_balance,
      coa.tax_line,
      coa.workpaper_ref,
      coa.preparer_notes,
      coa.reviewer_notes,
      coa.sort_order,
      coa.is_active,

      -- Unadjusted
      tb.unadjusted_debit,
      tb.unadjusted_credit,

      -- Book adjustments (sum of all 'book' type JE lines for this account+period)
      COALESCE(book_adj.total_debit, 0) AS book_adj_debit,
      COALESCE(book_adj.total_credit, 0) AS book_adj_credit,

      -- Tax adjustments (sum of all 'tax' type JE lines for this account+period)
      COALESCE(tax_adj.total_debit, 0) AS tax_adj_debit,
      COALESCE(tax_adj.total_credit, 0) AS tax_adj_credit,

      -- Book-adjusted = unadjusted + book AJEs
      (tb.unadjusted_debit + COALESCE(book_adj.total_debit, 0)) AS book_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(book_adj.total_credit, 0)) AS book_adjusted_credit,

      -- Tax-adjusted = book-adjusted + tax AJEs
      (tb.unadjusted_debit + COALESCE(book_adj.total_debit, 0) + COALESCE(tax_adj.total_debit, 0)) AS tax_adjusted_debit,
      (tb.unadjusted_credit + COALESCE(book_adj.total_credit, 0) + COALESCE(tax_adj.total_credit, 0)) AS tax_adjusted_credit,

      tb.updated_at,
      tb.updated_by

    FROM trial_balance tb
    JOIN chart_of_accounts coa ON coa.id = tb.account_id
    LEFT JOIN (
      SELECT
        jel.account_id,
        je.period_id,
        SUM(jel.debit) AS total_debit,
        SUM(jel.credit) AS total_credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'book'
      GROUP BY jel.account_id, je.period_id
    ) book_adj ON book_adj.account_id = tb.account_id
              AND book_adj.period_id = tb.period_id
    LEFT JOIN (
      SELECT
        jel.account_id,
        je.period_id,
        SUM(jel.debit) AS total_debit,
        SUM(jel.credit) AS total_credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.entry_type = 'tax'
      GROUP BY jel.account_id, je.period_id
    ) tax_adj ON tax_adj.account_id = tb.account_id
             AND tax_adj.period_id = tb.period_id
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop view first (depends on tables)
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');

  // Drop tables in reverse dependency order
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.dropTableIfExists('variance_notes');
  await knex.schema.dropTableIfExists('tax_line_reference');
  await knex.schema.dropTableIfExists('client_documents');
  await knex.schema.dropTableIfExists('classification_rules');
  await knex.schema.dropTableIfExists('bank_transactions');
  await knex.schema.dropTableIfExists('journal_entry_lines');
  await knex.schema.dropTableIfExists('journal_entries');
  await knex.schema.dropTableIfExists('trial_balance');
  await knex.schema.dropTableIfExists('chart_of_accounts');
  await knex.schema.dropTableIfExists('periods');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('app_users');
}
