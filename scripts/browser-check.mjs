// Optional QA dependency: install playwright-core separately and set
// PLAYWRIGHT_MODULE to its directory, or install it locally for development.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'docs/validation');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
const round=process.argv[2]??'round5';if(!/^round\d+$/.test(round))throw new Error('Expected roundN');
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const origin = process.env.APP_URL ?? 'http://localhost:3000';
const key = 'food-assistant:1.0.0:U_A:task';
const report = { version: pkg.version, checked_at: new Date().toISOString(), browser: browser.version(), cases: [], screenshots: [], errors: [] };
try { report.source_sha256 = JSON.parse(await readFile(resolve(output, `${round}.json`), 'utf8')).source_sha256; } catch { report.source_sha256 = null; }
const screenshot = async (page, name) => { name=name.replace('round2-',round+'-core-'); await page.screenshot({ path: resolve(output, name), fullPage: true }); report.screenshots.push(name); };
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const enter = async page => {
  await page.goto(origin);
  await page.getByRole('button', { name: '进入今天吃什么', exact: true }).click();
  await page.getByRole('heading', { name: '这一餐，试试这个？' }).waitFor();
};
let staticServer;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: '进入今天吃什么', exact: true }).waitFor();
  await screenshot(page, 'round2-home.png');
  await page.getByRole('button', { name: '进入今天吃什么', exact: true }).click();
  await screenshot(page, 'round2-assistant.png');
  assert.match(await page.locator('article[data-product="P01"]').innerText(), /21\.00/);
  await page.locator('article[data-product="P01"]').getByRole('button', { name: '选这餐' }).click();
  await page.getByRole('heading', { name: '确认这一餐', exact: true }).waitFor();
  assert.equal(await page.locator('#spec-dialog').isVisible(), false);
  assert.equal(await page.getByTestId('total').textContent(), '¥21.00');
  await screenshot(page, 'round2-confirm.png');
  await page.getByRole('textbox', { name: '订单备注' }).fill('放在前台。<b>不作为HTML执行</b>');
  await page.getByRole('button', { name: '确认并模拟提交' }).evaluate(button => { button.click(); button.click(); });
  await page.getByRole('heading', { name: '模拟订单已提交', exact: true }).waitFor();
  const submitted = await state(page), order = Object.values(submitted.orders)[0];
  assert.equal(order.amounts_fen.total, 2100); assert.equal(order.consumed_confirmed, false);
  assert.equal(order.status, 'submitted'); assert.equal(Object.keys(submitted.orders).length, 1);
  assert.equal(await page.locator('.saved-note b').count(), 0);
  await screenshot(page, 'round2-submitted.png');
  report.cases.push({ id: 'F01', status: 'passed', total_fen: 2100, consumed_confirmed: false });
  await page.reload();
  await page.getByRole('heading', { name: '模拟订单已提交', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '确认并模拟提交' }).count(), 0);
  assert.equal(Object.values((await state(page)).orders)[0].id, order.id);
  // A retry of the same domain event after refresh must also reuse the result.
  const retry = await page.evaluate(async () => {
    const { createStore } = await import('./src/state/store.js');
    const data = await (await fetch('./data/mock-data.json')).json();
    return createStore(data, { storage: localStorage }).dispatch({ type: 'SUBMIT_MOCK_ORDER' });
  });
  assert.equal(retry.reused, true); assert.equal(retry.order.id, order.id);
  assert.equal(Object.keys((await state(page)).orders).length, 1);
  report.cases.push({ id: 'F12', status: 'passed', duplicate_clicks: 2, refreshed: true, retry_reused: true, order_count: 1 });
  await page.getByRole('button', { name: '恢复示例', exact: true }).click();
  await page.locator('#action-dialog').getByRole('button', { name: '恢复示例', exact: true }).click();
  await page.getByRole('button', { name: '进入今天吃什么', exact: true }).click();
  await page.getByRole('button', { name: '看看另外 2 个选择' }).click();
  await page.locator('article[data-product="P09"]').getByRole('button', { name: '选这餐' }).click();
  const dialog = page.locator('#spec-dialog');
  assert.equal(await dialog.locator('input:checked').count(), 0);
  assert.equal(await dialog.getByRole('button', { name: '确认规格并继续' }).isDisabled(), true);
  assert.equal((await state(page)).cart.length, 0);
  await screenshot(page, 'round2-spec-required.png');
  await dialog.getByRole('radio', { name: '面食', exact: true }).check();
  assert.match(await dialog.locator('#spec-preview').innerText(), /28\.00/);
  await dialog.getByRole('button', { name: '确认规格并继续' }).click();
  assert.equal(await page.getByTestId('total').textContent(), '¥28.00');
  assert.equal((await state(page)).cart[0].configuration_id, 'noodle');
  await screenshot(page, 'round2-noodle-confirm.png');
  await page.getByRole('button', { name: '返回推荐' }).click();
  await page.getByRole('button', { name: '看看另外 2 个选择' }).click();
  assert.match(await page.locator('article[data-product="P09"]').innerText(), /已选配面条/);
  assert.match(await page.locator('article[data-product="P09"]').innerText(), /28\.00/);
  await page.getByRole('button', { name: '继续核对订单' }).click();
  await page.getByRole('button', { name: '确认并模拟提交' }).click();
  await page.getByRole('heading', { name: '模拟订单已提交', exact: true }).waitFor();
  report.cases.push({ id: 'F02', status: 'passed', initial_selected_specs: 0, submit_blocked_until_selected: true, configuration: 'noodle', total_fen: 2800, explanation_updated: true });
  await context.close();

  for (const width of [360, 390, 768, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', error => report.errors.push(error.message));
    await enter(p);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `assistant overflow at ${width}`);
    if (width === 390) await screenshot(p, 'round2-mobile.png');
    await p.locator('article[data-product="P01"]').getByRole('button', { name: '选这餐' }).click();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `confirmation overflow at ${width}`);
    await p.getByRole('button', { name: '确认并模拟提交' }).click();
    await p.getByRole('heading', { name: '模拟订单已提交', exact: true }).waitFor();
    report.cases.push({ id: `viewport-${width}`, status: 'passed', path: 'P01 to submission', horizontal_overflow: false });
    await ctx.close();
  }
  // Serve the real build below a repository subpath, without any API server.
  staticServer = http.createServer(async (request, response) => {
    const path = decodeURIComponent(request.url.split('?')[0]);
    if (!path.startsWith('/food-demo/') || path.includes('..')) { response.writeHead(404); response.end(); return; }
    const file = path.slice('/food-demo/'.length) || 'index.html';
    try {
      const body = await readFile(resolve(root, 'dist', file));
      response.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' })[extname(file)] }); response.end(body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
  const ctx = await browser.newContext(), p = await ctx.newPage();
  p.on('pageerror', error => report.errors.push(error.message));
  await p.goto(`http://127.0.0.1:${staticServer.address().port}/food-demo/`);
  await p.getByRole('button', { name: '进入今天吃什么', exact: true }).click();
  await p.locator('article[data-product="P01"]').getByRole('button', { name: '选这餐' }).click();
  await p.getByRole('button', { name: '确认并模拟提交' }).click();
  await p.getByRole('heading', { name: '模拟订单已提交', exact: true }).waitFor();
  assert.equal(await p.getByTestId('total').textContent(), '¥21.00');
  report.cases.push({ id: 'github-pages-subpath', status: 'passed', backend: false, online_deployment: false });
  await ctx.close();
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
} finally {
  await browser.close();
  if (staticServer) { staticServer.closeAllConnections(); await new Promise(resolve => staticServer.close(resolve)); }
  await writeFile(resolve(output, `${round}-regression.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
