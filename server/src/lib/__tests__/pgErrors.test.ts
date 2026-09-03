import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeBlockingTable, foreignKeyBlockMessage, isForeignKeyViolation, isRaisedException } from '../pgErrors';

test('isRaisedException recognises a trigger RAISE (P0001) that carries a message', () => {
  assert.equal(isRaisedException({ code: 'P0001', message: 'audit_log is append-only: DELETE is not permitted.' }), true);
  assert.equal(isRaisedException({ code: 'P0001' }), false);
  assert.equal(isRaisedException({ code: '23503', message: 'fk' }), false);
  assert.equal(isRaisedException(new Error('plain')), false);
});

test('isForeignKeyViolation recognises SQLSTATE 23503 and nothing else', () => {
  assert.equal(isForeignKeyViolation({ code: '23503' }), true);
  assert.equal(isForeignKeyViolation({ code: '23505' }), false);
  assert.equal(isForeignKeyViolation(new Error('nope')), false);
  assert.equal(isForeignKeyViolation(null), false);
  assert.equal(isForeignKeyViolation('23503'), false);
});

test('labels a known blocking table from the driver table field', () => {
  assert.equal(describeBlockingTable({ code: '23503', table: 'bank_transactions' }), 'bank transactions');
  assert.equal(describeBlockingTable({ code: '23503', table: 'document_imports' }), 'import history');
  assert.equal(describeBlockingTable({ code: '23503', table: 'periods' }), 'a period rolled forward from it');
});

test('falls back to the knex constraint name when the table field is missing', () => {
  assert.equal(
    describeBlockingTable({ code: '23503', constraint: 'bank_transactions_period_id_foreign' }),
    'bank transactions',
  );
  assert.equal(
    describeBlockingTable({ code: '23503', constraint: 'variance_notes_compare_period_id_foreign' }),
    'variance notes',
  );
});

test('an unknown table is humanised, and nothing at all reads as related records', () => {
  assert.equal(describeBlockingTable({ code: '23503', table: 'some_new_table' }), 'some new table');
  assert.equal(describeBlockingTable({ code: '23503' }), 'related records');
  assert.equal(describeBlockingTable({ code: '23503', constraint: 'weird_name' }), 'related records');
});

test('the message names the subject and what is attached', () => {
  const msg = foreignKeyBlockMessage({ code: '23503', table: 'bank_reconciliations' }, 'this period');
  assert.equal(msg, 'Cannot delete this period: it still has bank reconciliations attached. Remove those first, or contact an administrator.');
});
