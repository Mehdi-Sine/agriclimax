import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const webRequire = createRequire(path.resolve('apps/web/package.json'));
const lintRequire = createRequire(webRequire.resolve('eslint-config-next'));
const a11yRequire = createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const axePath = a11yRequire.resolve('axe-core/axe.min.js');
const base = 'http://127.0.0.1:3000';
const artifacts = path.resolve(process.env.DIAGNOSTIC_ARTIFACTS || 'work/diagnostic-browser');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 1024, 768], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', () => errors.push('page-error'));
    page.on('console', message => { if (message.type() === 'error') errors.push('console-error'); });
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== base) { external.push('remote-request'); await route.abort(); }
      else await route.continue();
    });
    await page.goto(`${base}/?production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&territory=demo-001&compare=2026-06-30`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'demo-001', exact: true }).click();
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible' });
    assert.ok(await page.locator('.maplibregl-canvas').isVisible());
    const link = page.getByRole('link', { name: 'Voir le diagnostic scientifique', exact: true }).filter({ visible: true }).first();
    const href = await link.getAttribute('href');
    assert.ok(href.includes('cell=demo-001'));
    await link.click();
    await page.waitForURL(/\/diagnostic\?/);
    await page.waitForLoadState('networkidle');
    assert.ok((await page.locator('main').innerText()).includes('demo_heat_wheat'));
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme') || 'light') !== theme)
        await page.getByRole('button', { name: theme === 'dark' ? 'Activer le thème sombre' : 'Activer le thème clair' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal overflow');
      await page.addScriptTag({ path: axePath });
      const audit = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      const violations = audit.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length }));
      reports.push({ name, theme, width, height, violations });
      await page.screenshot({ path: path.join(artifacts, `${name}-${theme}.png`), fullPage: true });
      await page.screenshot({ path: path.join(artifacts, `${name}-${theme}-viewport.png`) });
    }
    await page.reload({ waitUntil: 'networkidle' });
    assert.ok((await page.locator('main').innerText()).includes('Sensitivity'));
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').innerText(), 'Aller au contenu');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
    await page.getByLabel('Période consultée · début').fill('2026-06-30');
    await page.getByRole('button', { name: 'Consulter la série' }).click();
    await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).searchParams.get('start'), '2026-06-30');
    assert.ok((await page.locator('main').innerText()).includes('un seul résultat disponible'));
    const back = page.getByRole('link', { name: 'Retour à l’observation' });
    const backParams = new URL(await back.getAttribute('href'), base).searchParams;
    assert.equal(backParams.get('territory'), 'demo-001');
    assert.equal(backParams.get('compare'), '2026-06-30');
    await back.click(); await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname, '/');
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/diagnostic');
    const missing = new URL(href, base); missing.searchParams.set('cell', 'missing-cell');
    await page.goto(missing.toString(), { waitUntil: 'networkidle' });
    assert.ok((await page.locator('main').innerText()).includes('Données absentes'));
    assert.equal(await page.locator('.risk').count(), 0);
    await page.screenshot({ path: path.join(artifacts, `${name}-missing.png`) });
    await page.goto(`${base}/diagnostic?mode=live`, { waitUntil: 'networkidle' });
    assert.ok((await page.locator('main').innerText()).includes('Source indisponible'));
    assert.equal(await page.locator('[data-demo]').count(), 0);
    assert.equal(await page.locator('.risk').count(), 0);
    await page.screenshot({ path: path.join(artifacts, `${name}-live-invalid.png`) });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    reports.push({ name, flows: ['map-selection', 'map-diagnostic-link', 'deep-link', 'reload', 'keyboard', 'range', 'context-return', 'history', 'missing', 'live-invalid'], errors, external });
    await context.close();
  }
} finally {
  await writeFile(path.join(artifacts, 'report.json'), JSON.stringify(reports, null, 2));
  await browser.close();
}
assert.ok(reports.every(report => !report.violations || report.violations.length === 0), 'Accessibility violations; see report.json');
console.log('Diagnostic flows, responsive, light/dark and accessibility checks passed.');
