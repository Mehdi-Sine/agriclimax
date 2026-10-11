import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const webRequire = createRequire(path.resolve('apps/web/package.json'));
const lintRequire = createRequire(webRequire.resolve('eslint-config-next'));
const axePath = createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y')).resolve('axe-core/axe.min.js');
const base = process.env.INTEGRATION_BASE || 'http://127.0.0.1:3000';
const dir = path.resolve(process.env.INTEGRATION_ARTIFACTS || 'work/integration');
const realLive = process.env.INTEGRATION_LIVE === 'real';
await mkdir(dir, { recursive: true });
const executablePath = process.env.CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [];
const live = 'mode=live&production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&rule=demo_heat_wheat&version=1.0&bbox=-5.5,41,10,51.5&zoom=6';
try {
  for (const [name, width, height] of [['desktop',1440,900],['tablet',1024,768],['mobile',390,844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', () => errors.push('page-error'));
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== base) { external.push('external'); return route.abort(); }
      return route.continue();
    });
    async function capture(state) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}/${state} overflow`);
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa'] } })).violations.map(v => ({ id:v.id, impact:v.impact, count:v.nodes.length })));
      reports.push({ name, state, width, height, liveTransport: realLive ? 'Supabase DEV' : 'explicit browser stub / unconfigured diagnostic', violations });
      await page.locator('main').evaluate(el => el.focus({ preventScroll:true }));
      await page.evaluate(() => window.scrollTo(0,0));
      await page.screenshot({ path:path.join(dir, `${name}-${state}.png`), fullPage:true });
      await page.screenshot({ path:path.join(dir, `${name}-${state}-viewport.png`) });
      assert.deepEqual(violations, [], `${name}/${state} accessibility`);
    }
    await page.goto(`${base}/?mode=demo`, { waitUntil:'networkidle' });
    await page.locator('.maplibregl-canvas').waitFor({ state:'visible' });
    await page.getByRole('button', { name:'demo-001', exact:true }).click();
    await page.waitForURL('**territory=demo-001**');
    if (name === 'mobile') {
      const validity = await page.locator('.observation-bottom-sheet > small').boundingBox();
      const action = await page.locator('.observation-bottom-sheet > a').boundingBox();
      assert.ok(action.y >= validity.y + validity.height, 'Bottom sheet action must not overlap validity');
    }
    await capture('map');
    const link = page.getByRole('link', { name:'Voir le diagnostic scientifique', exact:true }).filter({ visible:true }).first();
    const diagnostic = new URL(await link.getAttribute('href'), base);
    await link.click(); await page.waitForURL('**/diagnostic?**'); await page.waitForLoadState('networkidle');
    await capture('diagnostic');
    // A copied diagnostic URL has no map territory. Its cell must restore the selection.
    diagnostic.searchParams.delete('territory');
    await page.goto(diagnostic.href, { waitUntil:'networkidle' });
    await page.getByRole('link', { name:'Retour à l’observation', exact:true }).click();
    await page.waitForURL('**territory=demo-001**');
    await page.getByRole('button', { name:'demo-001', exact:true }).waitFor();
    assert.equal(await page.getByRole('button', { name:'demo-001', exact:true }).getAttribute('aria-pressed'), 'true');
    if (name === 'desktop') {
      await page.getByRole('button', { name:'Diagnostic', exact:true }).click();
      await page.waitForURL('**/diagnostic?**');
      assert.equal(new URL(page.url()).searchParams.get('cell'), 'demo-001');
      await page.getByRole('link', { name:'Retour à l’observation', exact:true }).click();
    }
    await page.getByRole('button', { name:'Veille', exact:true }).filter({ visible:true }).first().click();
    await page.waitForURL('**/watch?**'); await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).searchParams.get('territory'), 'demo-001');
    await capture('watch');
    if (name === 'mobile') {
      const last = page.locator('.watch-main > .callout').last();
      await last.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const bottom = await last.boundingBox();
      const navigation = await page.locator('.mobile-nav').boundingBox();
      assert.ok(bottom.y + bottom.height <= navigation.y, 'Navigation must not cover final watch content');
    }
    await page.getByRole('link', { name:'Vérifier le signal', exact:true }).click();
    await page.waitForURL('**signal=**'); await page.waitForLoadState('networkidle');
    await capture('watch-detail');
    const map = new URL(await page.getByRole('link', { name:'Voir le contexte carte', exact:true }).getAttribute('href'), base);
    const diag = new URL(await page.getByRole('link', { name:'Ouvrir le diagnostic', exact:true }).getAttribute('href'), base);
    for (const key of ['production','indicator','date','rule','version']) assert.equal(map.searchParams.get(key), diag.searchParams.get(key));
    assert.ok((await page.locator('main').innerText()).includes('EvidenceBundle'));
    await page.getByRole('link', { name:'Ouvrir le diagnostic', exact:true }).click();
    await page.waitForURL('**/diagnostic?**');
    await page.getByRole('button', { name:'Activer le thème sombre' }).click();
    await capture('diagnostic-dark');
    // Real verification is opt-in; CI has no credentials and uses an explicit empty API stub.
    if (!realLive) await page.route('**/api/risks/map?*', route => route.fulfill({ json:{ type:'FeatureCollection', truncated:false, features:[] } }));
    await page.goto(`${base}/?${live}`, { waitUntil:'networkidle' });
    await page.locator('.observation-data-status .state-missing').waitFor();
    assert.equal(await page.locator('[data-demo=true]').count(),0);
    assert.equal(await page.locator('.observation-table tbody tr').count(),0);
    await capture('live-empty');
    await page.goto(`${base}/diagnostic?${live}&cell=demo-001`, { waitUntil:'networkidle' });
    await page.getByText(realLive ? 'Données absentes' : 'Source indisponible', { exact:true }).waitFor();
    assert.equal(await page.locator('[data-demo=true]').count(),0);
    await capture(realLive ? 'live-diagnostic-empty' : 'live-diagnostic-unconfigured');
    if (!realLive) await page.unroute('**/api/risks/map?*');
    await page.goto(`${base}/watch?${live}`, { waitUntil:'networkidle' });
    assert.equal(await page.locator('.signal-card').count(),0);
    assert.equal(await page.locator('[data-demo=true]').count(),0);
    await capture('live-watch-unconnected');
    // Client API errors and transport errors must clear the result, with explicit retry.
    for (const kind of ['api-error','network-error']) {
      await page.route('**/api/risks/map?*', route => kind === 'network-error' ? route.abort('failed') : route.fulfill({ status:503, json:{ error:{ code:'UPSTREAM_UNAVAILABLE' } } }));
      await page.goto(`${base}/?${live}`, { waitUntil:'networkidle' });
      await page.locator('.observation-data-status .state-source-error').waitFor();
      assert.equal(await page.locator('.observation-table tbody tr').count(),0);
      assert.equal(await page.locator('[data-demo=true]').count(),0);
      await capture(kind);
      await page.unroute('**/api/risks/map?*');
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await context.close();
  }
} finally {
  await writeFile(path.join(dir,'report.json'), JSON.stringify(reports,null,2));
  await browser.close();
}
console.log(`${reports.length} integration/responsive/AA states passed.`);
