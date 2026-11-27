import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import catalog from '../sheets/invocation-catalog.json' with { type: 'json' };

test('offline invocation entries match the exact pinned Agentic OS catalog', async () => {
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const resolved = lock.packages['node_modules/agentic-os']?.resolved;
  const revision = resolved?.match(/\/tar\.gz\/([a-f0-9]{40})$/u)?.[1];
  assert.equal(catalog.revision, revision);

  const source = await readFile(new URL(import.meta.resolve('agentic-os/catalog/invocation.json')));
  assert.equal(catalog.sourceSha256, 'sha256:' + createHash('sha256').update(source).digest('hex'));
  const { entries } = JSON.parse(source.toString('utf8'));
  assert.deepEqual(catalog.entries, entries.map(entry => ({
    token: entry.token, summary: entry.summary,
    subject: entry.kind[0].toUpperCase() + entry.kind.slice(1),
    verb: entry.action || 'Unspecified',
    object: entry.accepts?.join(', ') || entry.name || entry.value || 'Unspecified',
  })));
});
