// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Make audit_log effectively append-only via BEFORE UPDATE / BEFORE DELETE
 * row-level triggers that RAISE. REVOKE would have no effect — the app user is
 * usually also the table owner — so a DB-level trigger is the right layer.
 *
 * Operations that legitimately need to prune or repair audit_log (e.g. GDPR
 * deletion requests, or archival jobs in the far future) can opt out within a
 * single transaction by setting `app.audit_log_mutation_allowed = 'true'`:
 *
 *   BEGIN;
 *     SET LOCAL app.audit_log_mutation_allowed = 'true';
 *     DELETE FROM audit_log WHERE created_at < now() - interval '7 years';
 *   COMMIT;
 */
exports.up = async function (knex) {
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
  await knex.raw(`
    DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
    CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_append_only_guard();
  `);
  await knex.raw(`
    DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
    CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_append_only_guard();
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log`);
  await knex.raw(`DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log`);
  await knex.raw(`DROP FUNCTION IF EXISTS audit_log_append_only_guard()`);
};
