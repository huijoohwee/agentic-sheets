import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyUpstreamAssets } from '../scripts/check-design-upstream.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the editor uses the sealed owner styles and native named targets', async () => {
  const [html, toolbar, panel, sheet, sealed] = await Promise.all([
    read('sheets/index.html'), read('design/toolbar.css'), read('design/floating-panel.css'), read('sheets/styles.css'), read('sheets/dist/styles.css'),
  ]);
  const collection = (await read('design/collection-layout.css')).replace(/^@import "\.\/toolbar\.css";\s*/u, '');
  assert.doesNotMatch(sealed, /@import\b/u);
  assert.equal(sealed, [toolbar, panel, await read('design/panel-section.css'), collection, await read('design/skills-commands.css'), sheet].join('\n'));
  assert.deepEqual([...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]),
    ['./shared-ui-profile.css', './styles.css']);
  assert.doesNotMatch(html, /<style\b|\sstyle\s*=/i);
  assert.match(html, /<body data-agentic-typography\b/);
  assert.match(html, /<main(?=[^>]*id="workbook")(?=[^>]*aria-labelledby="workbook-title")(?=[^>]*data-selection-target="workbook-editor")[^>]*>/);
  assert.match(html, /<label class="agentic-fact-label" for="cell-input">/);
  const actions = html.match(/<nav\b[^>]*id="workbook-actions"[^>]*>[\s\S]*?<\/nav>/)?.[0];
  assert.match(actions, /class="agentic-toolbar" data-scroll aria-label="Workbook actions" data-selection-target="workbook-actions"/);
  for (const [tag] of html.matchAll(/<button\b[^>]*>/g)) {
    const owner = actions.includes(tag) ? 'agentic-toolbar-item' : 'agentic-form-control';
    assert.ok(tag.includes('class="' + owner + '"'), tag);
    assert.match(tag, /\bid="[^"]+"/);
  }
  assert.match(actions, /<button(?=[^>]*id="mark-worksheet")(?=[^>]*aria-controls="grid-section")(?=[^>]*aria-pressed="false")[^>]*>Mark worksheet<\/button>/);
  assert.doesNotMatch(html, /data-agentic-annotation-target="true"/);
  assert.match(html, /<section(?=[^>]*id="grid-section")(?=[^>]*class="agentic-table-frame")(?=[^>]*aria-label="Scrollable workbook grid")(?=[^>]*data-selection-target="worksheet-grid")[^>]*>/);
  assert.match(html, /<table role="grid"[^>]*data-agentic-table-fit="container"/);
  assert.match(html, /<section id="snapshots"[^>]*aria-labelledby="snapshot-title"/);
});

test('workbook CSS reserves shared control styling and target geometry for the design system', async () => {
  const css = (await read('sheets/styles.css')).replace(/\/\*[\s\S]*?\*\//g, '').trim();
  // The workbook owns cell geometry. The shared collection stylesheet sizes the grid and frame.
  // Shared components and their interaction states are styled by the two sealed projections.
  const layout = new Set(['display', 'grid-template-columns', 'justify-items', 'gap', 'margin', 'min-inline-size', 'inline-size', 'overflow-wrap']);
  const hosts = new Set(['#editor-fieldset', '#snapshots', '#cell-input', '#snapshot-title', '#workbook-details']);
  const grid = new Set([
    '#grid-section', '#grid-section table', '#grid-section :is(th, td)', '#grid-section tbody th',
    '#grid-section tr > th:first-child', '#grid-section thead th:first-child',
    '#grid-section td', '#grid-section td:is([data-kind="number"], [data-kind="formula"])', '#grid-section td[data-error]',
  ]);
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.equal(rules.map(([rule]) => rule).join('').trim(), css);
  assert.doesNotMatch(css, /@|!important|--[\w-]+\s*:|pointer-events\s*:|(?:^|[\s;{])(?:all|outline|opacity)\s*:/m);
  for (const [, rawSelector, declarations] of rules) {
    const selector = rawSelector.trim();
    if (selector === 'body') {
      assert.deepEqual(declarations.split(';').map(part => part.trim()).filter(Boolean).sort(), [
        'background: var(--agentic-panel-background)', 'color: var(--agentic-panel-foreground)',
        'margin: 0',
      ]);
    } else if (grid.has(selector)) {
      for (const [, property, value] of declarations.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
        if (/^(?:background|border(?:-(?:inline|block)-end)?|font-family)$/.test(property)) {
          assert.match(value, /^var\(--agentic-[\w-]+\)$/, property + ' must use a shared token');
        }
        assert.ok(!['color', 'background-color', 'box-shadow', 'border-radius'].includes(property), property);
      }
    } else {
      for (const host of selector.split(/,\s*/)) assert.ok(hosts.has(host), 'Unowned UI selector: ' + host);
      for (const [key] of declarations.matchAll(/[\w-]+(?=\s*:)/g)) assert.ok(layout.has(key), selector + ': ' + key);
    }
  }
});

test('the Functions tab and inline editor use their pinned implementations', async () => {
  const [html, app, editor, bundle, pinText] = await Promise.all([
    read('sheets/index.html'), read('sheets/app.mjs'), read('design/inline-editor.mjs'),
    read('sheets/dist/app.mjs'), read('design/shared-ui-profile.pin.json'),
  ]);
  const pin = JSON.parse(pinText);
  assert.equal(pin.inlineEditor.sourcePath, 'site/inline-editor.js');
  assert.equal(pin.floatingPanel.sourcePath, 'site/floating-panel.js');
  assert.ok(bundle.startsWith(editor));
  const binding = await read('sheets/workbook-panel.mjs');
  for (const name of ['floating-panel.js', 'toolbar-icons.js', 'icons.json', 'skills-commands.js', 'panel-section.js', 'collection-layout.js']) {
    assert.equal(await read('sheets/dist/' + name), await read('design/' + name), name);
  }
  const { openWorkbookTools } = await import('../sheets/dist/floating-panel.mjs');
  assert.equal(typeof openWorkbookTools, 'function');
  assert.match(binding, /mountFloatingPanel\(trigger/);
  assert.match(binding, /mountSkillsCommandsReference\(/);
  assert.match(html, /data-panel-tab="functions" data-panel-label="Functions"/);
  assert.match(html, /id="function-list" class="agentic-collection" data-layout="list"/);
  assert.match(app, /item.className = 'agentic-collection-item'/);
  assert.ok((await read('sheets/dist/styles.css')).includes((await read('design/collection-layout.css')).replace(/^@import "\.\/toolbar\.css";\s*/u, '')));
  assert.doesNotMatch(html + app, /<details|agentic-base-floating-panel|agentic-floating-panel-tab|role="tablist"/);
});

test('upstream verification proves vendored assets equal authentic owner bytes, rejecting forks and drift', () => {
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const owner = 'github.com/huijoohwee/agentic-design-system';
  const sourceBytes = Buffer.from('{"tokens":[]}\n');
  const projectionBytes = Buffer.from(':root{--agentic-row-height:38px}\n');
  const toolbarBytes = Buffer.from('.agentic-toolbar{}\n');
  const layoutBytes = Buffer.from('.agentic-collection{}\n');
  const rev = 'a'.repeat(40);
  const layoutRev = 'b'.repeat(40);
  const pin = {
    profile: { owner, sourceRevision: rev, sourceSha256: `sha256:${sha(sourceBytes)}`, sourcePath: 'site/tokens/shared-ui-profile.json', registryRevision: rev, projectionSha256: `sha256:${sha(projectionBytes)}`, projectionPath: 'site/vendor/shared-ui-profile.css' },
    toolbar: { sourcePath: 'site/toolbar.css', sha256: `sha256:${sha(toolbarBytes)}` },
    collectionLayoutStyles: { sourcePath: 'site/collection-layout.css', sha256: `sha256:${sha(layoutBytes)}`, registryRevision: layoutRev },
  };
  const ownerStore = {
    [`site/tokens/shared-ui-profile.json@${rev}`]: sourceBytes,
    [`site/vendor/shared-ui-profile.css@${rev}`]: projectionBytes,
    [`site/toolbar.css@${rev}`]: toolbarBytes,
    [`site/collection-layout.css@${layoutRev}`]: layoutBytes,
  };
  const localStore = { 'shared-ui-profile.css': projectionBytes, 'toolbar.css': toolbarBytes, 'collection-layout.css': layoutBytes };
  const ownerBlob = (path, revision) => { const bytes = ownerStore[`${path}@${revision}`]; if (!bytes) throw new Error(`missing owner blob ${path}@${revision}`); return bytes; };
  const localAsset = name => { const bytes = localStore[name]; if (!bytes) throw new Error(`missing local ${name}`); return bytes; };
  const verified = verifyUpstreamAssets({ pin, localAsset, ownerBlob });
  assert.deepEqual(verified, ['shared-ui-profile.css', 'toolbar.css', 'collection-layout.css']);
  // Forked local asset.
  assert.throws(() => verifyUpstreamAssets({ pin, localAsset: name => name === 'toolbar.css' ? Buffer.from('fork') : localAsset(name), ownerBlob }), /vendored Design System asset differs/u);
  // Drifted pin digest.
  assert.throws(() => verifyUpstreamAssets({ pin: { ...pin, toolbar: { ...pin.toolbar, sha256: `sha256:${sha(Buffer.from('other'))}` } }, localAsset, ownerBlob }), /asset pin drift/u);
  // Wrong owner.
  assert.throws(() => verifyUpstreamAssets({ pin: { ...pin, profile: { ...pin.profile, owner: 'github.com/example/fork' } }, localAsset, ownerBlob }), /owner mismatch/u);
  // Forked owner projection relative to the pin.
  assert.throws(() => verifyUpstreamAssets({ pin, localAsset, ownerBlob: (path, revision) => path === 'site/vendor/shared-ui-profile.css' ? Buffer.from('fork') : ownerBlob(path, revision) }), /projection differs from pinned owner bytes/u);
});
