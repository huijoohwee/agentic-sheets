import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFormulaDraft, LIMITS } from 'agentic-sheets';

test('draft references share the calculation grammar, normalize labels and expand ranges once', () => {
  const draft = '=b2 + 4e2 + SUM( b2 : C3 ) + B2 + P32';
  const references = [
    { label: 'B2', addresses: ['B2'] },
    { label: 'B2:C3', addresses: ['B2', 'C2', 'B3', 'C3'] },
    { label: 'P32', addresses: ['P32'] },
  ];
  assert.deepEqual(inspectFormulaDraft(draft), { references, functionName: null });
  assert.deepEqual(inspectFormulaDraft(draft, draft.indexOf(':')), { references, functionName: 'SUM' });
});
test('incomplete drafts give caret-local help before the expression can calculate', () => {
  for (const draft of ['=sum(', '=sum(B', '=sum(B4:', '=sum(B4:C']) {
    assert.equal(inspectFormulaDraft(draft).functionName, 'SUM');
  }
  assert.deepEqual(inspectFormulaDraft('=sum(B4:').references, [{ label: 'B4', addresses: ['B4'] }]);
  const draft = '=(SUM(B2:C3)+B2)';
  assert.equal(inspectFormulaDraft(draft, draft.indexOf('SUM')).functionName, null);
  assert.equal(inspectFormulaDraft(draft, draft.indexOf('+')).functionName, null);
  assert.equal(inspectFormulaDraft(draft, draft.indexOf('C3')).functionName, 'SUM');
});
test('literals, unsupported calls, invalid ranges and oversized drafts do not mark cells', () => {
  for (const draft of ["'=B2", 'A1', '=7e-3', '=IPMT(B1)', '=Q1', '=A33', '=SUM(C2:A4)',
    '=SUM(A1:Q1)', '=A1+' + ' '.repeat(LIMITS.formulaBytes), '=A1' + '+1'.repeat(LIMITS.tokens)]) {
    assert.deepEqual(inspectFormulaDraft(draft), { references: [], functionName: null }, draft);
  }
});
