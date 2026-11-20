// Optional browser regression. Use an installed Playwright and a running local dev server.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:4177/agentic-sheets/';
const browser = await chromium.launch();
try {
  for (const [mode, options] of [
    ['desktop', { viewport: { width: 940, height: 850 } }],
    ['touch', { viewport: { width: 360, height: 800 }, hasTouch: true, colorScheme: 'dark' }],
    ['forced colors', { forcedColors: 'active' }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route(/^https?:/, route => {
      if (new URL(route.request().url()).origin === new URL(url).origin) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    await page.goto(url);
    await page.getByRole('button', { name: 'Create sample' }).click();
    await page.waitForFunction(() => document.querySelector('#cell-D4')?.textContent === '80');
    await page.getByRole('button', { name: 'Mark worksheet' }).click();
    const input = page.locator('#cell-input'), cell = page.locator('#cell-E4');
    await cell[options.hasTouch ? 'tap' : 'click']();
    if (options.hasTouch) await cell.tap();
    else await cell.press('F2');

    const inline = cell.getByRole('textbox', { name: 'Edit cell E4' });
    assert.equal(await inline.evaluate(e => e === document.activeElement), true);
    assert.equal(await inline.evaluate(e => {
      const field = e.getBoundingClientRect(), host = e.parentElement.getBoundingClientRect();
      return field.width > 0 && field.height > 0 && field.left >= host.left && field.right <= host.right
        && field.top >= host.top && field.bottom <= host.bottom;
    }), true);

    const draft = '=B2+C2+SUM(D2:D3)';
    await inline.fill(draft);
    assert.equal(await input.inputValue(), draft);
    await inline.press('ArrowLeft');
    await page.locator('#function-help').waitFor({ state: 'visible' });
    const labels = page.locator('.agentic-reference-label');
    assert.deepEqual(await labels.allTextContents(), ['B2', 'C2', 'D2:D3']);
    assert.deepEqual(await page.locator('td[data-agentic-reference]').evaluateAll(nodes => nodes.map(e => e.id)),
      ['cell-B2', 'cell-C2', 'cell-D2', 'cell-D3']);
    for (const [index, address] of ['B2', 'C2', 'D2', 'D3'].entries()) {
      const target = page.locator('#cell-' + address);
      const label = labels.nth(Math.min(index, 2));
      const line = await target.evaluate(e => {
        const s = getComputedStyle(e, '::before');
        return [s.borderTopStyle, s.borderTopColor, s.pointerEvents];
      });
      const key = await label.evaluate(e => {
        const s = getComputedStyle(e); return [s.borderBottomStyle, s.borderBottomColor];
      });
      assert.equal(line[0], ['solid', 'dashed', 'dotted', 'dotted'][index]);
      assert.equal(line[2], 'none');
      assert.deepEqual(line.slice(0, 2), key);
    }
    assert.equal(await page.locator('#grid-section').getAttribute('data-agentic-annotation-target'), 'true');
    assert.equal(await cell.getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await inline.press('ArrowRight');
    await page.locator('#function-help').waitFor({ state: 'hidden' });
    await input.fill('=SUM(B2:');
    assert.deepEqual(await labels.allTextContents(), ['B2']);
    assert.equal(await inline.inputValue(), '=SUM(B2:');
    await inline.press('Escape');
    assert.equal(await inline.count(), 0);
    assert.equal(await cell.evaluate(e => document.activeElement === e), true);
    assert.equal(await input.inputValue(), '');
    assert.equal(await page.locator('[data-agentic-reference]').count(), 0);
    assert.match(await page.locator('#status').textContent(), /revision 1 saved/);

    await cell.press('=');
    assert.equal(await inline.inputValue(), '=');
    await inline.fill('x'.repeat(1025));
    await inline.press('Enter');
    assert.match(await page.getByRole('alert').textContent(), /LIMIT/);
    await page.locator('#cell-D4').click();
    assert.equal(await inline.inputValue(), 'x'.repeat(1025));
    assert.equal(await cell.getAttribute('aria-selected'), 'true');

    await input.fill(draft);
    assert.equal(await inline.inputValue(), draft);
    await inline.dispatchEvent('compositionstart');
    await inline.press('Enter');
    await inline.press('Escape');
    assert.equal(await inline.inputValue(), draft);
    await inline.dispatchEvent('compositionend');
    await inline.press('Enter');
    await page.waitForFunction(() => document.querySelector('#cell-E4')?.textContent === '107');
    assert.equal(await page.locator('[data-agentic-reference]').count(), 0);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#cell-E4')?.textContent === '107');
    await cell.dblclick();
    assert.equal(await inline.inputValue(), draft);
    await input.focus();
    await input.evaluate(e => e.setSelectionRange(e.value.length, e.value.length));
    await input.press('ArrowLeft');
    await page.locator('#function-help').waitFor({ state: 'visible' });
    assert.deepEqual(await labels.allTextContents(), ['B2', 'C2', 'D2:D3']);
    assert.equal(await input.inputValue(), draft);
    await inline.fill('=2+3');
    await inline.press('Enter');
    await page.waitForFunction(() => document.querySelector('#cell-E4')?.textContent === '5');
    assert.match(await page.locator('#status').textContent(), /revision 3 saved/);
    await cell.press('Enter');
    await inline.press('Enter');
    assert.match(await page.locator('#status').textContent(), /revision 3 saved/);
    assert.equal(await inline.count(), 0);
    if (mode === 'desktop') {
      const peer = await context.newPage();
      await peer.goto(url);
      await peer.waitForFunction(() => document.querySelector('#cell-E4')?.textContent === '5');
      await cell.press('F2');
      await inline.fill('19');
      await peer.locator('#cell-E4').dblclick();
      const peerInput = peer.getByRole('textbox', { name: 'Edit cell E4' });
      await peerInput.fill('23'); await peerInput.press('Enter');
      await peer.waitForFunction(() => document.querySelector('#cell-E4')?.textContent === '23');
      await inline.press('Enter');
      await page.waitForFunction(() => document.querySelector('#error').textContent.includes('CONFLICT'));
      assert.equal(await inline.inputValue(), '19');
      assert.equal(await input.inputValue(), '19');
      assert.equal(await inline.evaluate(e => e.readOnly), false);
      await page.getByRole('button', { name: 'Discard draft & reload' }).click();
      await page.waitForFunction(() => document.querySelector('#cell-E4')?.textContent === '23');
      assert.equal(await inline.count(), 0);
      await peer.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await context.close();
    console.log(mode + ' passed');
  }
} finally { await browser.close(); }
