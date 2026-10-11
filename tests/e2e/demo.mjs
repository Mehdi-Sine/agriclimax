import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const webRequire = createRequire(path.resolve('apps/web/package.json'));
const nextLintRequire = createRequire(webRequire.resolve('eslint-config-next'));
const a11yRequire = createRequire(nextLintRequire.resolve('eslint-plugin-jsx-a11y'));
const axePath = a11yRequire.resolve('axe-core/axe.min.js');
const baseURL = 'http://127.0.0.1:3000';
const artifactDir = path.resolve(process.env.QUALITY_ARTIFACTS || 'work/quality/e2e');
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
});
const reports = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 1024, 768], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const failures = [];
    const external = [];
    page.on('pageerror', () => failures.push('browser-page-error'));
    page.on('console', (message) => { if (message.type() === 'error') failures.push('browser-console-error'); });
    // Demo must work offline: every non-local request is blocked and reported.
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== baseURL) {
        external.push(url.hostname); // never write full URLs/query strings to artifacts
        await route.abort();
      } else await route.continue();
    });
    const start = performance.now();
    const response = await page.goto(`${baseURL}/?production=wheat_soft&date=2026-07-01`, { waitUntil: 'networkidle', timeout: 30000 });
    assert.equal(response.status(), 200);
    assert.ok((await response.body()).length < 256 * 1024, 'Demo HTML exceeds 256 KiB');
    const durationMs = performance.now() - start;
    assert.ok(durationMs < 15000, 'Local demo navigation exceeds 15s smoke budget');
    assert.ok(await page.locator('main').isVisible(), 'Visible main landmark required');
    assert.ok((await page.locator('body').innerText()).includes('AgriclimaX'));
    assert.ok((await page.locator('[data-demo="true"]').first().innerText()).includes('Données fictives'));
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow');
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await page.addScriptTag({ path: axePath });
    const a11y = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    // No page content, URLs, or DOM fragments in reports.
    const violations = a11y.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length }));
    reports.push({ name, width, height, durationMs: Math.round(durationMs), violations });
    await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
    // Collect every viewport before enforcing the accessibility gate.
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').innerText(), 'Aller au contenu');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
    if (name === 'mobile') {
      const opener = page.getByRole('button', { name: 'Filtres', exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible' });
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press('Tab');
        assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      }
      await page.keyboard.press('Escape');
      assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    }
    await page.getByRole('button', { name: 'Veille', exact: true }).filter({ visible: true }).first().click();
    await page.waitForURL('**/watch?**');
    await page.getByRole('link', { name: 'Vérifier le signal', exact: true }).click();
    await page.getByRole('link', { name: 'Ouvrir le diagnostic', exact: true }).click();
    await page.waitForURL('**/diagnostic?**');
    assert.ok((await page.locator('main').innerText()).includes('demo-fiction'));
    for (const route of ['/', '/design-system']) {
      await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme') || 'light') !== theme) {
          await page.getByRole('button', { name: theme === 'dark' ? 'Activer le thème sombre' : 'Activer le thème clair' }).click();
        }
        await page.addScriptTag({ path: axePath });
        const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
        const issues = result.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length }));
        reports.push({ name, route, theme, violations: issues });
        // All violations remain blocking at the final aggregate gate.
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (route === '/design-system') {
          assert.equal(await page.locator('.skeleton').first().evaluate(el => getComputedStyle(el).animationName), 'none');
        }
      }
    }
    await page.goto(`${baseURL}/?production=dairy_cattle&date=2026-02-30&territory=%3Cscript%3E`, { waitUntil: 'networkidle' });
    assert.ok(await page.locator('[data-demo="true"]').first().isVisible(), 'Demo survives empty/invalid context');
    assert.deepEqual(failures, [], 'Browser errors');
    assert.deepEqual(external, [], 'Unexpected remote dependency in demo');
    await context.close();
  }
} finally {
  await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify(reports, null, 2));
  await browser.close();
}
assert.ok(reports.every(report => report.violations.length === 0), 'Blocking accessibility violations: see report.json');
console.log('Demo E2E, accessibility and responsive checks passed (desktop/tablet/mobile).');
