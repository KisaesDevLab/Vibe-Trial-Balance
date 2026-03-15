exports.up = async function(knex) {
  await knex.schema.createTable('app_users', (t) => {
    t.increments('id').primary();
    t.string('username', 100).unique().notNullable();
    t.string('password_hash', 255).notNullable();
    t.string('display_name', 255);
    t.string('role', 20).defaultTo('preparer');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });
  await knex.schema.createTable('clients', (t) => {
    t.increments('id').primary();
    t.string('name', 255).notNullable();
    t.string('entity_type', 20).notNullable();
    t.string('tax_year_end', 5);
    t.string('default_tax_software', 50);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });
  await knex.schema.createTable('periods', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('period_name', 100).notNullable();
    t.date('start_date');
    t.date('end_date');
    t.boolean('is_current').defaultTo(false);
    t.integer('rolled_forward_from').unsigned().references('id').inTable('periods');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('chart_of_accounts', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('account_number', 20).notNullable();
    t.string('account_name', 255).notNullable();
    t.string('category', 50).notNullable();
    t.string('subcategory', 100);
    t.string('normal_balance', 10).notNullable();
    t.string('tax_line', 50);
    t.string('workpaper_ref', 20);
    t.text('preparer_notes');
    t.text('reviewer_notes');
    t.integer('sort_order').defaultTo(0);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
    t.unique(['client_id', 'account_number']);
  });
  await knex.schema.createTable('trial_balance', (t) => {
    t.increments('id').primary();
    t.integer('period_id').unsigned().notNullable().references('id').inTable('periods').onDelete('CASCADE');
    t.integer('account_id').unsigned().notNullable().references('id').inTable('chart_of_accounts').onDelete('CASCADE');
    t.bigInteger('unadjusted_debit').defaultTo(0);
    t.bigInteger('unadjusted_credit').defaultTo(0);
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.integer('updated_by').unsigned().references('id').inTable('app_users');
    t.unique(['period_id', 'account_id']);
  });
  await knex.schema.createTable('journal_entries', (t) => {
    t.increments('id').primary();
    t.integer('period_id').unsigned().notNullable().references('id').inTable('periods').onDelete('CASCADE');
    t.integer('entry_number').notNullable();
    t.string('entry_type', 10).notNullable();
    t.date('entry_date').notNullable();
    t.text('description');
    t.boolean('is_recurring').defaultTo(false);
    t.integer('created_by').unsigned().references('id').inTable('app_users');
    t.timestamps(true, true);
  });
  await knex.schema.createTable('journal_entry_lines', (t) => {
    t.increments('id').primary();
    t.integer('journal_entry_id').unsigned().notNullable().references('id').inTable('journal_entries').onDelete('CASCADE');
    t.integer('account_id').unsigned().notNullable().references('id').inTable('chart_of_accounts');
    t.bigInteger('debit').defaultTo(0);
    t.bigInteger('credit').defaultTo(0);
  });
  await knex.schema.createTable('bank_transactions', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.integer('period_id').unsigned().references('id').inTable('periods');
    t.date('transaction_date').notNullable();
    t.string('description', 500);
    t.bigInteger('amount').notNullable();
    t.string('check_number', 20);
    t.integer('account_id').unsigned().references('id').inTable('chart_of_accounts');
    t.integer('ai_suggested_account_id').unsigned().references('id').inTable('chart_of_accounts');
    t.float('ai_confidence');
    t.string('classification_status', 20).defaultTo('unclassified');
    t.integer('classified_by').unsigned().references('id').inTable('app_users');
    t.timestamp('imported_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('classification_rules', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('payee_pattern', 500).notNullable();
    t.integer('account_id').unsigned().notNullable().references('id').inTable('chart_of_accounts');
    t.integer('times_confirmed').defaultTo(1);
    t.timestamps(true, true);
    t.unique(['client_id', 'payee_pattern']);
  });
  await knex.schema.createTable('client_documents', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('filename', 255).notNullable();
    t.string('file_path', 500).notNullable();
    t.integer('file_size');
    t.string('file_type', 50);
    t.integer('linked_account_id').unsigned().references('id').inTable('chart_of_accounts');
    t.integer('linked_journal_entry_id').unsigned().references('id').inTable('journal_entries');
    t.integer('uploaded_by').unsigned().references('id').inTable('app_users');
    t.timestamp('uploaded_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('tax_line_reference', (t) => {
    t.increments('id').primary();
    t.string('entity_type', 20).notNullable();
    t.string('tax_software', 50).notNullable();
    t.string('tax_line_code', 50).notNullable();
    t.string('tax_line_description', 255).notNullable();
    t.string('form_section', 100);
    t.integer('sort_order').defaultTo(0);
    t.unique(['entity_type', 'tax_software', 'tax_line_code']);
  });
  await knex.schema.createTable('variance_notes', (t) => {
    t.increments('id').primary();
    t.integer('account_id').unsigned().notNullable().references('id').inTable('chart_of_accounts');
    t.integer('period_id').unsigned().notNullable().references('id').inTable('periods');
    t.integer('compare_period_id').unsigned().notNullable().references('id').inTable('periods');
    t.text('note').notNullable();
    t.integer('created_by').unsigned().references('id').inTable('app_users');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['account_id', 'period_id', 'compare_period_id']);
  });
  await knex.schema.createTable('audit_log', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().references('id').inTable('app_users');
    t.string('action', 50).notNullable();
    t.string('table_name', 50).notNullable();
    t.integer('record_id');
    t.jsonb('old_values');
    t.jsonb('new_values');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw("CREATE VIEW v_adjusted_trial_balance AS SELECT tb.period_id, tb.account_id, coa.account_number, coa.account_name, coa.category, coa.normal_balance, coa.tax_line, coa.workpaper_ref, coa.sort_order, coa.is_active, tb.unadjusted_debit, tb.unadjusted_credit, COALESCE(ba.td, 0) AS book_adj_debit, COALESCE(ba.tc, 0) AS book_adj_credit, COALESCE(ta.td, 0) AS tax_adj_debit, COALESCE(ta.tc, 0) AS tax_adj_credit, (tb.unadjusted_debit + COALESCE(ba.td, 0)) AS book_adjusted_debit, (tb.unadjusted_credit + COALESCE(ba.tc, 0)) AS book_adjusted_credit, (tb.unadjusted_debit + COALESCE(ba.td, 0) + COALESCE(ta.td, 0)) AS tax_adjusted_debit, (tb.unadjusted_credit + COALESCE(ba.tc, 0) + COALESCE(ta.tc, 0)) AS tax_adjusted_credit FROM trial_balance tb JOIN chart_of_accounts coa ON coa.id = tb.account_id LEFT JOIN (SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.entry_type = 'book' GROUP BY jel.account_id, je.period_id) ba ON ba.account_id = tb.account_id AND ba.period_id = tb.period_id LEFT JOIN (SELECT jel.account_id, je.period_id, SUM(jel.debit) AS td, SUM(jel.credit) AS tc FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.entry_type = 'tax' GROUP BY jel.account_id, je.period_id) ta ON ta.account_id = tb.account_id AND ta.period_id = tb.period_id");
};

exports.down = async function(knex) {
  await knex.raw('DROP VIEW IF EXISTS v_adjusted_trial_balance');
  const tables = ['audit_log','variance_notes','tax_line_reference','client_documents','classification_rules','bank_transactions','journal_entry_lines','journal_entries','trial_balance','chart_of_accounts','periods','clients','app_users'];
  for (const t of tables) { await knex.schema.dropTableIfExists(t); }
};
