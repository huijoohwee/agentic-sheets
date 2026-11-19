import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the editor uses the sealed owner styles and native named targets', async () => {
  const [html, toolbar, panel, sheet, sealed] = await Promise.all([
    read('sheets/index.html'), read('design/toolbar.css'), read('design/floating-panel.css'), read('sheets/styles.css'), read('sheets/dist/styles.css'),
  ]);
  assert.equal(sealed, [toolbar, panel, await read('design/panel-section.css'), await read('design/collection-layout.css'), await read('design/skills-commands.css'), sheet].join('\n'));
  assert.deepEqual([...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]),
    ['./shared-ui-profile.css', './styles.css']);
  assert.doesNotMatch(html, /<style\b|\sstyle\s*=/i);
  const actions = html.match(/<nav\b[^>]*id="workbook-actions"[^>]*>[\s\S]*?<\/nav>/)?.[0];
  assert.match(actions, /class="agentic-toolbar" data-scroll aria-label=/);
  for (const [tag] of html.matchAll(/<button\b[^>]*>/g)) {
    const owner = actions.includes(tag) ? 'agentic-toolbar-item' : 'agentic-form-control';
    assert.ok(tag.includes('class="' + owner + '"'), tag);
    assert.match(tag, /\bid="[^"]+"/);
  }
  assert.match(actions, /<button(?=[^>]*id="mark-worksheet")(?=[^>]*aria-controls="grid-section")(?=[^>]*aria-pressed="false")[^>]*>Mark worksheet<\/button>/);
  assert.doesNotMatch(html, /data-agentic-annotation-target="true"/);
  assert.match(html, /<section id="grid-section"[^>]*aria-label=/);
  assert.match(html, /<section id="snapshots"[^>]*aria-labelledby="snapshot-title"/);
});

test('workbook CSS reserves shared control styling and target geometry for the design system', async () => {
  const css = (await read('sheets/styles.css')).replace(/\/\*[\s\S]*?\*\//g, '').trim();
  // The workbook owns table geometry and layout around the controls.
  // Shared components and their interaction states are styled by the two sealed projections.
  const layout = new Set(['display', 'grid-template-columns', 'justify-items', 'gap', 'margin', 'min-inline-size', 'inline-size', 'overflow-wrap']);
  const hosts = new Set(['#editor-fieldset', '#snapshots', '#cell-input', '#snapshot-title', '#workbook-details']);
  const grid = new Set([
    '#grid-section', '#grid-section table', '#grid-section :is(th, td)', '#grid-section th',
    '#grid-section thead th', '#grid-section tr > th:first-child', '#grid-section thead th:first-child',
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
        'font: var(--agentic-font-size-body)/var(--agentic-line-height-body) var(--agentic-font-sans)', 'margin: 0',
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
  const [html, app, editor, panel, bundle, panelBundle, pinText] = await Promise.all([
    read('sheets/index.html'), read('sheets/app.mjs'), read('design/inline-editor.mjs'),
    read('design/floating-panel.js'), read('sheets/dist/app.mjs'), read('sheets/dist/floating-panel.mjs'), read('design/shared-ui-profile.pin.json'),
  ]);
  const pin = JSON.parse(pinText);
  assert.equal(pin.inlineEditor.sourcePath, 'site/inline-editor.js');
  assert.equal(pin.floatingPanel.sourcePath, 'site/floating-panel.js');
  assert.ok(bundle.startsWith(editor));
  assert.ok(panelBundle.includes(panel.slice(panel.indexOf('\n') + 1)));
  const binding = await read('sheets/workbook-panel.mjs');
  for (const name of ['skills-commands', 'panel-section', 'collection-layout']) {
    const owned = await read(`design/${name}.js`);
    assert.ok(panelBundle.includes(owned.replace(/^(?:import [^\n]*\n)+/, '')), `${name} must use the pinned implementation`);
  }
  assert.match(binding, /mountFloatingPanel\(trigger/);
  assert.match(binding, /mountSkillsCommandsReference\(/);
  assert.match(html, /data-panel-tab="functions" data-panel-label="Functions"/);
  assert.match(html, /id="function-list" class="agentic-collection" data-layout="list"/);
  assert.match(app, /item.className = 'agentic-collection-item'/);
  assert.ok((await read('sheets/dist/styles.css')).includes(await read('design/collection-layout.css')));
  assert.doesNotMatch(html + app, /<details|agentic-base-floating-panel|agentic-floating-panel-tab|role="tablist"/);
});
