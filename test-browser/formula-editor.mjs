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
    await page.waitForFunction(() => document.querySelector('#cell-D4').textContent === '80');
    await page.getByRole('button', { name: 'Mark worksheet' }).click();
    const input = page.locator('#cell-input'), cell = page.locator('#cell-E4');
    await cell[options.hasTouch ? 'tap' : 'click']();
    if (options.hasTouch) await input.tap();
    else await cell.press('F2');

    const draft = '=B2+C2+SUM(D2:D3)';
    await input.fill(draft);
    await input.press('ArrowLeft');
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
    await input.press('ArrowRight');
    await page.locator('#function-help').waitFor({ state: 'hidden' });
    await input.fill('=SUM(B2:');
    assert.deepEqual(await labels.allTextContents(), ['B2']);
    await input.press('Escape');
    assert.equal(await page.locator('[data-agentic-reference]').count(), 0);
    assert.match(await page.locator('#status').textContent(), /revision 1 saved/);

    await input.fill(draft);
    await input.press('Enter');
    await page.waitForFunction(() => document.querySelector('#cell-E4').textContent === '107');
    assert.equal(await page.locator('[data-agentic-reference]').count(), 0);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#cell-E4').textContent === '107');
    await cell.click(); await input.focus();
    await input.evaluate(e => e.setSelectionRange(e.value.length, e.value.length));
    await input.press('ArrowLeft');
    await page.locator('#function-help').waitFor({ state: 'visible' });
    assert.deepEqual(await labels.allTextContents(), ['B2', 'C2', 'D2:D3']);
    assert.equal(await input.inputValue(), draft);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await context.close();
    console.log(mode + ' passed');
  }
} finally { await browser.close(); }
