import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCells } from '../sheets/record-views.mjs';
import { buildSheetsArtifact } from '../scripts/build-sheets.mjs';

test('record projections retain cell coordinates, calculated errors and literal display values', () => {
  const text = '<b>text</b>';
  const rows = projectCells({ A10: { type: 'formula' }, AA1: { type: 'text' }, B1: { type: 'boolean' } },
    { A10: { error: 'DIV_ZERO', display: '#DIV/0!' }, AA1: { value: text }, B1: { value: false } });
  assert.deepEqual(rows.map(row => row.cells), [['B1', 'B', 'boolean', 'false'], ['AA1', 'AA', 'text', text], ['A10', 'A', 'formula', '#DIV/0!']]);
});
test('the installed workbook includes all three owner views within its transfer budget', async () => {
  const { files, manifest } = await buildSheetsArtifact();
  assert.ok(manifest.installAssetBytes + files.get('artifact-manifest.json').length < 400000);
  for (const name of ['browser-data-view.js', 'browser-data-view.css']) {
    assert.ok(files.get(name).length < 500000);
    assert.ok(files.get(name + '.gz').length < files.get(name).length);
    assert.ok(files.get('sw.js').includes(manifest.files.find(file => file.path === name).sha256));
  }
});
