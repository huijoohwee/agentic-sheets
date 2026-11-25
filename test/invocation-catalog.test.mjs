import assert from 'node:assert/strict';
import { openReferenceIndex } from 'agentic-gateway/references';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import catalog from '../sheets/invocation-catalog.json' with { type: 'json' };

test('offline reference entries retain the pinned invocation tokens and their source facets', async () => {
  const asset = name => readFile(new URL(import.meta.resolve('agentic-gateway/references/' + name)), 'utf8');
  const index = await openReferenceIndex(await asset('index.json'), JSON.parse(await asset('pin.json')));
  const { metadata, bytes } = await index.select('command-catalog/invocation', entry => {
    assert.equal(entry.owner, 'agentic-os');
    assert.equal(entry.path, 'catalog/invocation.json');
    const source = process.env.AGENTIC_OS_INVOCATION_SOURCE ?? new URL(import.meta.resolve(entry.owner + '/' + entry.path));
    return readFile(source);
  });
  assert.equal(catalog.sourceSha256, 'sha256:' + metadata.digest);
  assert.equal(catalog.revision, metadata.revision);
  const { entries, entryCount } = JSON.parse(new TextDecoder().decode(bytes));
  assert.equal(catalog.entries.length, entryCount);
  assert.deepEqual(catalog.entries, entries.map(entry => ({
    token: entry.token, summary: entry.summary,
    subject: entry.kind[0].toUpperCase() + entry.kind.slice(1),
    verb: entry.action || 'Unspecified',
    object: entry.accepts?.join(', ') || entry.name || entry.value || 'Unspecified',
  })));
});
