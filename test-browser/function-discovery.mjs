// Optional browser check. Pass a candidate URL and, for a rollback rehearsal, a predecessor URL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const candidate = new URL(process.argv[2] || 'http://127.0.0.1:4177/agentic-sheets/');
const predecessor = process.argv[3] && new URL(process.argv[3]);
const browser = await chromium.launch();
const mobile = { viewport: { width: 360, height: 800 }, hasTouch: true };
const cells = [['A1', '2', '2'], ['A2', '3', '3'], ['B1', '=SUM(A1:A2)', '5']];
async function enterValues(page, tap) {
  for (const [address, value, display] of cells) {
    await page.locator('#cell-' + address).click();
    await page.locator('#cell-input').fill(value);
    if (tap) await page.locator('#commit').tap();
    else await page.locator('#cell-input').press('Enter');
    await page.waitForFunction(([address, display]) => document.getElementById('cell-' + address).textContent === display, [address, display]);
  }
}
async function acceptedBytes(page) {
  return page.evaluate(async () => {
    const { createSheetsStore } = await import('./storage.mjs');
    const { encodeSnapshot } = await import('./core.mjs');
    const store = createSheetsStore({ authorize: () => true });
    try { return encodeSnapshot(await store.load()); }
    finally { await store.close(); }
  });
}
async function loadMetrics(page) {
  return page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation');
    return {
      loadMs: Math.round(nav.loadEventEnd),
      pageTransferBytes: [nav, ...performance.getEntriesByType('resource')].reduce((bytes, entry) => bytes + entry.transferSize, 0),
    };
  });
}
async function discoverOffline() {
  const context = await browser.newContext(mobile);
  const page = await context.newPage();
  const external = [], errors = [];
  context.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== candidate.origin) external.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  const start = performance.now();
  await page.goto(candidate.href);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const primedMs = Math.round(performance.now() - start);
  const cold = await loadMetrics(page);
  await context.setOffline(true);
  await page.reload();
  const warm = await loadMetrics(page);
  await page.locator('#blank').tap();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('revision 1 saved'));
  const taskStart = performance.now();
  const field = page.locator('#cell-input'), trigger = page.getByRole('button', { name: 'Functions', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Workbook tools' });
  const tab = dialog.getByRole('tab', { name: 'Functions', selected: true });
  const panel = dialog.getByRole('tabpanel', { name: 'Functions' });
  const unchanged = await acceptedBytes(page);
  const [entry] = await page.evaluate(async () => (await import('./core.mjs')).listFunctions());
  await field.fill('=su');
  await field.evaluate(e => e.setSelectionRange(1, 3, 'backward'));
  await field.press('Tab');
  assert.ok(await trigger.evaluate(e => e === document.activeElement));
  await trigger.press('Enter');
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.count(), 1);
  assert.equal(await dialog.getByRole('tab').count(), 1);
  assert.ok(await tab.evaluate(e => e === document.activeElement));
  await tab.press('ArrowRight');
  assert.ok(await tab.evaluate(e => e === document.activeElement));
  assert.equal(await tab.getAttribute('aria-controls'), await panel.getAttribute('id'));
  assert.equal(await panel.getAttribute('aria-labelledby'), await tab.getAttribute('id'));
  assert.ok(await dialog.evaluate(e => {
    const rect = e.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth
      && rect.top >= 0 && rect.bottom <= innerHeight;
  }));
  await panel.locator('dt').waitFor({ state: 'visible' });
  assert.deepEqual(await panel.locator('dt').allTextContents(), [entry.signature]);
  const accessible = await panel.ariaSnapshot();
  for (const value of [entry.signature, entry.arguments[0].description, entry.example.formula, 'returns 5']) {
    assert.ok(accessible.includes(value), accessible);
  }
  await tab.press('Escape');
  assert.equal(await dialog.count(), 0);
  await page.waitForFunction(() => document.activeElement === document.querySelector('#cell-input'));
  assert.deepEqual(await field.evaluate(e => [e.value, e.selectionStart, e.selectionEnd, e.selectionDirection]), ['=su', 1, 3, 'backward']);
  await field.press('Escape');
  assert.equal(await acceptedBytes(page), unchanged);
  await enterValues(page, true);
  const taskMs = Math.round(performance.now() - taskStart);
  const accepted = await acceptedBytes(page);
  assert.match(await page.locator('#status').textContent(), /revision 4 saved/);
  await page.reload();
  const cell = page.locator('#cell-B1');
  await page.waitForFunction(() => document.querySelector('#cell-B1').textContent === '5');
  await cell.tap();
  await cell.tap();
  const inline = cell.getByRole('textbox');
  await inline.fill('=SUM(A1:');
  await inline.evaluate(e => e.setSelectionRange(5, 7));
  await trigger.tap();
  await panel.locator('dd').waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).tap();
  assert.equal(await dialog.count(), 0);
  await page.waitForFunction(() => document.activeElement === document.querySelector('#cell-B1 input'));
  assert.deepEqual(await inline.evaluate(e => [e.value, e.selectionStart, e.selectionEnd]), ['=SUM(A1:', 5, 7]);
  await inline.press('Escape');
  assert.equal(await acceptedBytes(page), accepted);
  assert.equal(await cell.textContent(), '5');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(JSON.stringify({ primedMs, cold, warm, automatedTaskMs: taskMs, externalRequests: external.length }));
  await context.close();
}
async function rehearseRollback() {
  // Keep the origin and IndexedDB constant while switching the static files served at that origin.
  const context = await browser.newContext({ ...mobile, serviceWorkers: 'block' });
  let serving = predecessor;
  await context.route(predecessor.origin + '/**', async route => {
    const request = new URL(route.request().url());
    const upstream = new URL(request.pathname + request.search, serving.origin);
    await route.fulfill({ response: await route.fetch({ url: upstream.href }) });
  });
  const page = await context.newPage();
  await page.goto(predecessor.href);
  await page.locator('#blank').click();
  await enterValues(page, false);
  const accepted = await acceptedBytes(page);
  for (const [url, hasPanel] of [[candidate, true], [predecessor, false]]) {
    serving = url;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#cell-B1').textContent === '5');
    assert.equal(await page.locator('#open-functions').count() === 1, hasPanel);
    assert.match(await page.locator('#status').textContent(), /revision 4 saved/);
    assert.equal(await acceptedBytes(page), accepted);
  }
  console.log('Predecessor → candidate → predecessor: revision 4, B1 = 5, snapshot SHA-256 ' + createHash('sha256').update(accepted).digest('hex'));
  await context.close();
}
try {
  await discoverOffline();
  if (predecessor) await rehearseRollback();
} finally { await browser.close(); }
