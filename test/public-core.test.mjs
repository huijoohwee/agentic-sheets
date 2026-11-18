import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public headless entry reads a Base v1 snapshot and preserves its revision fence', async () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof indexedDB, 'undefined');
  const { CONTRACT, calculate, decodeSnapshot, encodeSnapshot, executeWorkbook } = await import('agentic-sheets');
  const fixture = await readFile(new URL('./fixtures/base-v1.json', import.meta.url), 'utf8');
  const original = decodeSnapshot(fixture);
  assert.equal(calculate(original).B1.value, 12);
  const payload = { workbookId: original.workbookId, sheetId: original.sheetId,
    changes: [{ address: 'A1', cell: { type: 'number', value: 7 } }] };
  const edit = { contract: CONTRACT, operation: 'setCells', operationId: 'update', expectedRevision: 1, payload };
  const { workbook } = await executeWorkbook(original, edit);
  const reopened = decodeSnapshot(encodeSnapshot(workbook));
  assert.deepEqual(reopened, workbook);
  assert.equal(reopened.revision, 2);
  assert.equal(reopened.cells.B1.value, '=A1*3');
  assert.equal(calculate(reopened).B1.value, 21);
  assert.equal((await executeWorkbook(reopened, edit)).replayed, true);
  await assert.rejects(executeWorkbook(reopened, { ...edit, operationId: 'stale' }), { code: 'CONFLICT' });
  const restore = await executeWorkbook(reopened, { contract: CONTRACT, operation: 'restore', operationId: 'restore',
    expectedRevision: 2, payload: { workbookId: original.workbookId, mode: 'replace', snapshot: original } });
  assert.equal(restore.workbook.revision, 3);
  assert.equal(calculate(restore.workbook).B1.value, 12);
});
