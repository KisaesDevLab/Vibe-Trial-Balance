/**
 * Period delete, part two. 20260903000001 gave the five silent references a
 * delete action, but `audit_log.period_id` was already CASCADE — and
 * 20260418000002 made audit_log append-only with a BEFORE DELETE trigger that
 * RAISES. So deleting any period with audit history (every real one) asked
 * Postgres to delete its audit rows, the trigger refused, and the route still
 * reported a 500. A fresh database has no audit rows, which is why the fix
 * verified there and failed in production.
 *
 * Cascading was wrong anyway: the audit trail is supposed to outlive what it
 * describes. The rows now stay and only their period pointer is cleared
 * (ON DELETE SET NULL — they keep `client_id`, so they still read under the
 * client). SET NULL is itself an UPDATE, which the BEFORE UPDATE trigger
 * would also refuse, so the guard learns exactly one exception: an update
 * that changes nothing but `period_id`, and only to NULL. Every other update
 * and every delete still raises; the SET LOCAL escape hatch is unchanged.
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION audit_log_append_only_guard() RETURNS trigger AS $$
    BEGIN
      IF current_setting('app.audit_log_mutation_allowed', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
      END IF;
      -- A deleted period's rows keep everything but the pointer
      -- (audit_log.period_id is ON DELETE SET NULL).
      IF TG_OP = 'UPDATE'
         AND NEW.period_id IS NULL
         AND OLD.period_id IS NOT NULL
         AND (to_jsonb(NEW) - 'period_id') = (to_jsonb(OLD) - 'period_id') THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'audit_log is append-only: % is not permitted. Set app.audit_log_mutation_allowed=true for one-off maintenance.', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.schema.alterTable('audit_log', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('audit_log', (t) => {
    t.dropForeign(['period_id']);
    t.foreign('period_id').references('id').inTable('periods').onDelete('CASCADE');
  });

  await knex.raw(`
    CREATE OR REPLACE FUNCTION audit_log_append_only_guard() RETURNS trigger AS $$
    BEGIN
      IF current_setting('app.audit_log_mutation_allowed', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
      END IF;
      RAISE EXCEPTION 'audit_log is append-only: % is not permitted. Set app.audit_log_mutation_allowed=true for one-off maintenance.', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
};
