import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import catalog from '../sheets/invocation-catalog.json' with { type: 'json' };

test('offline reference entries retain the pinned invocation tokens and their source facets', async t => {
  let bytes;
  try {
    bytes = await readFile(process.env.AGENTIC_OS_INVOCATION_SOURCE || new URL('../node_modules/agentic-os/catalog/invocation.json', import.meta.url));
  } catch (error) {
    if (error.code !== 'ENOENT' || process.env.AGENTIC_OS_INVOCATION_SOURCE) throw error;
    return t.skip('Install the pinned agentic-os dev dependency to compare the upstream catalog');
  }
  assert.equal('sha256:' + createHash('sha256').update(bytes).digest('hex'), catalog.sourceSha256);
  const { entries, entryCount } = JSON.parse(bytes);
  assert.equal(catalog.entries.length, entryCount);
  assert.deepEqual(catalog.entries, entries.map(entry => ({
    token: entry.token, summary: entry.summary,
    subject: entry.kind[0].toUpperCase() + entry.kind.slice(1),
    verb: entry.action || 'Unspecified',
    object: entry.accepts?.join(', ') || entry.name || entry.value || 'Unspecified',
  })));
});
