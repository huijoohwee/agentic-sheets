import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import * as core from 'agentic-sheets';

const number = value => ({ type: 'number', value });
const formula = value => ({ type: 'formula', value });
async function create(api, cells) {
  const result = await api.executeWorkbook(null, {
    contract: api.CONTRACT, operation: 'create', expectedRevision: 0, operationId: 'example',
    payload: { workbookId: 'functions', sheetId: 'sheet', name: 'Function fixtures', cells },
  });
  return result.workbook;
}

test('the installed binding is immutable plain data and its advertised example calculates', async () => {
  const entries = core.listFunctions();
  assert.deepEqual(entries.map(fn => fn.id), ['math.sum']);
  assert.deepEqual(JSON.parse(JSON.stringify(entries)), entries);
  const [fn] = entries;
  for (const value of [entries, fn, fn.arguments, ...fn.arguments, fn.example, fn.example.cells]) {
    assert.ok(Object.isFrozen(value));
  }
  assert.equal(fn.binding, core.CONTRACT);
  assert.equal(fn.signature, fn.name + '(' + fn.arguments[0].name + ')');
  assert.equal(fn.arguments[0].kind, 'range');
  assert.equal(core.inspectFormulaDraft('=' + fn.name.toLowerCase() + '(').functionName, fn.name);
  const cells = Object.fromEntries(Object.entries(fn.example.cells).map(([address, value]) => [address, number(value)]));
  const workbook = await create(core, { ...cells, B1: formula(fn.example.formula) });
  assert.equal(core.calculate(workbook).B1.value, fn.example.result);
});

test('v1 source, order, errors, budgets and accepted snapshot bytes survive a version round trip', async () => {
  const predecessor = process.env.SHEETS_PREDECESSOR_CORE
    ? await import(pathToFileURL(process.env.SHEETS_PREDECESSOR_CORE)) : core;
  const cases = [
    ['=sum(A1:A3)', { A1: number(2), A2: number(3) }, 5],
    ['=SUM(A1:A2)', { A2: { type: 'text', value: '3' } }, 'VALUE'],
    ['=SUM(A2:A1)', {}, 'REFERENCE'], ['=SUM(A1:Q2)', {}, 'REFERENCE'],
    ['=SUM(B1:B1)', { B1: formula('=C1') }, 'CYCLE'], ['=SUM(A1:A2)', { A2: formula('=1/0') }, 'DIV_ZERO'],
    ['=SUM(A1:A2)', { A1: number(1e308), A2: number(1e308) }, 'NUMBER'],
    ['=SUM(A1:B2)', { A1: number(1e16), B1: number(1), A2: number(-1e16), B2: number(1) }, 1],
    ['=AVERAGE(A1:A2)', {}, 'PARSE'],
  ];
  for (const [source, cells, expected] of cases) {
    const input = { ...cells, C1: formula(source) };
    const old = await create(predecessor, input);
    const candidate = await create(core, input);
    assert.equal(candidate.cells.C1.value, source);
    const results = core.calculate(candidate);
    assert.equal(results.C1.error ?? results.C1.value, expected);
    assert.deepEqual(results, predecessor.calculate(old));
    const oldBytes = predecessor.encodeSnapshot(old);
    const candidateBytes = core.encodeSnapshot(candidate);
    assert.equal(candidateBytes, oldBytes);
    assert.equal(core.encodeSnapshot(core.decodeSnapshot(oldBytes)), oldBytes);
    assert.equal(predecessor.encodeSnapshot(predecessor.decodeSnapshot(candidateBytes)), oldBytes);
  }
  const repeated = '=' + Array(9).fill('SUM(A1:A32)').join('+');
  const overBudget = Object.fromEntries(Array.from({ length: 16 }, (_, i) => ['B' + (i + 1), formula(repeated)]));
  for (const api of new Set([core, predecessor])) {
    await assert.rejects(create(api, overBudget), { code: 'LIMIT', message: 'Calculation operation limit exceeded' });
  }
});
