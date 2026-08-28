/**
 * Document storage: pluggable backend (local disk or B2) on client_documents.
 *
 * Every addition is nullable or defaulted, so existing rows stay valid with no
 * backfill: they keep storage_backend='local', a null object_key (the sentinel
 * meaning "legacy layout — read via file_path"), and their absolute file_path.
 *
 * Also fixes a live bug. file_type is varchar(50), but two MIME types already
 * in ALLOWED_MIME_TYPES are longer:
 *   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet    (65)
 *   application/vnd.openxmlformats-officedocument.wordprocessingml.document (71)
 * so uploading any .xlsx or .docx today fails with
 * "value too long for type character varying(50)" and returns a 500.
 */
exports.up = async function (knex) {
  const hasBackend = await knex.schema.hasColumn('client_documents', 'storage_backend');
  if (!hasBackend) {
    await knex.schema.alterTable('client_documents', (t) => {
      t.string('storage_backend', 20).notNullable().defaultTo('local');
      // varchar(1024) matches the B2 key cap enforced by enforceKeyByteCap.
      // NULL on legacy rows — that is the backward-compatibility sentinel.
      t.string('object_key', 1024).nullable();
      t.string('bucket', 255).nullable();
      // Computed by us: an S3/B2 ETag is not a content hash.
      t.string('sha256', 64).nullable();
      t.string('etag', 255).nullable();
      // SET NULL, not CASCADE: deleting a period must not destroy documents.
      t.integer('period_id').unsigned().nullable()
        .references('id').inTable('periods').onDelete('SET NULL');
      // Which folder-template section this landed in.
      t.string('section', 100).nullable();
      t.timestamp('deleted_at', { useTz: true }).nullable();
      t.integer('deleted_by').unsigned().nullable()
        .references('id').inTable('app_users').onDelete('SET NULL');
    });
  }

  // Widen the columns that are too narrow. file_path becomes nullable because a
  // B2-backed row has no disk path.
  await knex.raw('ALTER TABLE client_documents ALTER COLUMN file_type TYPE varchar(200)');
  await knex.raw('ALTER TABLE client_documents ALTER COLUMN filename TYPE varchar(500)');
  await knex.raw('ALTER TABLE client_documents ALTER COLUMN file_path DROP NOT NULL');

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS client_documents_client_period_idx
      ON client_documents (client_id, period_id) WHERE deleted_at IS NULL
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS client_documents_client_section_idx
      ON client_documents (client_id, section) WHERE deleted_at IS NULL
  `);
  // One live row per stored object. COALESCE on bucket because local-backend
  // rows have bucket NULL, and Postgres treats NULLs as distinct — indexing the
  // raw column would mean the invariant simply does not exist on the default
  // backend, which is exactly where a key collision would go unnoticed.
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS client_documents_object_unique
      ON client_documents (COALESCE(bucket, ''), object_key)
      WHERE object_key IS NOT NULL AND deleted_at IS NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS client_documents_object_unique');
  await knex.raw('DROP INDEX IF EXISTS client_documents_client_section_idx');
  await knex.raw('DROP INDEX IF EXISTS client_documents_client_period_idx');

  const hasBackend = await knex.schema.hasColumn('client_documents', 'storage_backend');
  if (hasBackend) {
    await knex.schema.alterTable('client_documents', (t) => {
      t.dropColumn('deleted_by');
      t.dropColumn('deleted_at');
      t.dropColumn('section');
      t.dropColumn('period_id');
      t.dropColumn('etag');
      t.dropColumn('sha256');
      t.dropColumn('bucket');
      t.dropColumn('object_key');
      t.dropColumn('storage_backend');
    });
  }

  // Narrowing back would truncate, so only the NOT NULL is restored — and only
  // when no row would violate it.
  const nulls = await knex('client_documents').whereNull('file_path').count({ n: '*' }).first();
  if (Number(nulls && nulls.n) === 0) {
    await knex.raw('ALTER TABLE client_documents ALTER COLUMN file_path SET NOT NULL');
  }
};
