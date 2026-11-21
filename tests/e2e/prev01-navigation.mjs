import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const [origin, output] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, locale: 'fr-FR'});
  const selector = '.national-map[data-ready="true"][data-rendered-contour-count="713"]';
  const report = {navigation: [], interaction: []};
  const paths = '/climat?temporal=forecast&weather_model=ifs&weather_run=2026-11-14';
  const weather = (predicate) => page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/operational' && response.ok() && predicate(url.searchParams);
  }, {timeout: 30_000});
  for (const phase of ['new_context', 'same_context']) {
    const response = weather(params => params.has('date'));
    const started = performance.now();
    await page.goto(origin + paths, {waitUntil: 'domcontentloaded'});
    const result = await (await response).json();
    assert.equal(result.native_support.status, 'verified');
    await page.locator(selector).waitFor({timeout: 60_000});
    await page.locator('.map-updating').waitFor({state: 'hidden'});
    const elapsed = performance.now() - started;
    const volumes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((sum, r) => sum + r.transferSize, 0));
    report.navigation.push({phase, ms: Math.round(elapsed), transferBytes: volumes});
  }
  const run = '2026-11-15T18:00:00+00:00';
  const changedCycle = weather(params => params.has('date') && params.get('run') === run);
  await page.getByLabel('Cycle archivé · UTC').selectOption(run);
  const cycle = await (await changedCycle).json();
  assert.equal(cycle.run, run);
  assert.equal(cycle.native_support.status, 'verified');
  report.interaction.push({control: 'cycle', value: run});
  const currentDate = cycle.rows[0].valid_date;
  const later = cycle.available_dates.filter(date => date > run.slice(0, 10) && date !== currentDate).at(-1);
  assert.ok(later);
  const [changedDate] = await Promise.all([
    weather(params => params.get('date') === later && !params.has('pra')),
    page.locator('label').filter({hasText: /^Date · UTC/}).locator('select').selectOption(later),
  ]);
  const dated = await changedDate.json();
  assert.ok(dated.rows.every(row => row.valid_date === later));
  assert.equal(dated.native_support.status, 'verified');
  report.interaction.push({control: 'échéance', value: later});
  const corsican = dated.rows.find(row => /^pra:2[AB]/.test(row.pra_id)).pra_id;
  const detail = weather(params => params.get('pra') === corsican);
  await page.locator('label').filter({hasText: /^PRA/}).locator('select').selectOption(corsican);
  const selected = await (await detail).json();
  assert.ok(selected.rows.length && selected.rows.every(row => row.pra_id === corsican));
  await page.getByText('Provenance et limites', {exact: true}).click();
  await page.getByText(/Empreinte source/).waitFor();
  report.interaction.push({control: 'PRA', value: corsican});
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
} finally {
  await browser.close();
}
