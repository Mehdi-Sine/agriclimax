import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('work/browser/package.json'));
const { chromium } = require('playwright');
const webRequire = createRequire(path.resolve('apps/web/package.json'));
const lintRequire = createRequire(webRequire.resolve('eslint-config-next'));
const a11yRequire = createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const axePath = a11yRequire.resolve('axe-core/axe.min.js');
const artifacts = path.resolve('docs/codex/verification/task07');
const base = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const reports = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 1024, 768], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) { external.push(url.hostname); await route.abort(); } else await route.continue();
    });
    async function audit(state) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}/${state}: overflow`);
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length })));
      reports.push({ name, state, width, height, violations });
      assert.deepEqual(violations, [], `${name}/${state}: accessibility`);
    }
    async function visit(query = '') {
      const response = await page.goto(`${base}/watch${query}`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
    }
    await visit();
    assert.equal(await page.locator('.signal-card').count(), 1);
    await audit('compact');
    await page.screenshot({ path: path.join(artifacts, `${name}-list.png`), fullPage: true });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    if (name === 'mobile') {
      const opener = page.getByRole('button', { name: 'Filtres', exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog');
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press('Tab');
        assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      }
      await audit('filter-sheet');
      await page.screenshot({ path: path.join(artifacts, 'mobile-filters.png'), fullPage: true });
      await dialog.getByRole('combobox', { name: 'Production', exact: true }).selectOption('dairy_cattle');
      await dialog.getByRole('button', { name: 'Appliquer', exact: true }).click();
    } else {
      await page.locator('.desktop-only').getByRole('combobox', { name: 'Production', exact: true }).selectOption('dairy_cattle');
      await page.locator('.desktop-only').getByRole('button', { name: 'Appliquer', exact: true }).click();
    }
    await page.waitForURL('**/watch?**production=dairy_cattle**');
    await page.getByText('Données absentes', { exact: true }).waitFor();
    assert.equal(await page.locator('.signal-card').count(), 0);
    await audit('empty');
    await page.screenshot({ path: path.join(artifacts, `${name}-empty.png`), fullPage: true });
    await visit('?density=detailed&production=wheat_soft&territory=demo-001&date=2026-07-01&risk=moderate&compare=2026-06-30');
    await audit('detailed-list');
    await page.getByRole('link', { name: 'Vérifier le signal', exact: true }).click();
    await page.waitForURL('**signal=**');
    await page.getByRole('heading', { name: 'Vérifier un signal', exact: true }).waitFor();
    await audit('detail');
    assert.ok((await page.locator('main').innerText()).includes('Template déterministe'));
    await page.screenshot({ path: path.join(artifacts, `${name}-detail.png`), fullPage: true });
    const mapLink = new URL(await page.getByRole('link', { name: 'Voir le contexte carte', exact: true }).getAttribute('href'), base);
    for (const [key, value] of [['production', 'wheat_soft'], ['territory', 'demo-001'], ['date', '2026-07-01'], ['indicator', 'tmax_days_above'], ['compare', '2026-06-30']]) assert.equal(mapLink.searchParams.get(key), value);
    await page.getByRole('link', { name: 'Retour à la liste', exact: true }).click();
    await page.getByRole('button', { name: 'Activer le thème sombre' }).click();
    await audit('dark-list');
    await page.screenshot({ path: path.join(artifacts, `${name}-dark.png`), fullPage: true });
    await visit('?mode=live');
    await audit('live-unavailable');
    assert.equal(await page.locator('.signal-card').count(), 0);
    assert.equal(await page.locator('[data-demo="true"]').count(), 0);
    await page.screenshot({ path: path.join(artifacts, `${name}-live-unavailable.png`), fullPage: true });
    assert.deepEqual(external, [], 'Demo must not request external services');
    assert.deepEqual(errors, [], 'Browser errors');
    await context.close();
  }
} finally {
  await writeFile(path.join(artifacts, 'browser-report.json'), JSON.stringify(reports, null, 2));
  await browser.close();
}
console.log(`${reports.length} responsive/a11y states passed, no external requests or browser errors.`);
