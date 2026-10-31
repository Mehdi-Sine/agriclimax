// Real Task19D DEV reads; only the explicitly labelled network-failure test aborts a request.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url),
  { chromium } = require('playwright');
const web = createRequire(path.resolve('apps/web/package.json')),
  lint = createRequire(web.resolve('eslint-config-next')),
  axe = createRequire(lint.resolve('eslint-plugin-jsx-a11y'));
const base = process.env.NATIONAL_BASE_URL || 'http://127.0.0.1:3020';
assert.equal(new URL(base).hostname, '127.0.0.1');
const dir = 'work/task20/browser';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const report = { real_dev: true, viewports: [], cases: [], errors: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => report.errors.push(e.message));
  let mark = Date.now();
  await page.goto(`${base}/territories`, { waitUntil: 'domcontentloaded' });
  await page
    .getByText('complete · 645', { exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .locator('.national-map[data-ready="true"]')
    .waitFor({ timeout: 60000 });
  report.initial_ready_ms = Date.now() - mark;
  assert.equal(
    await page.locator('.national-map').getAttribute('data-feature-count'),
    '713',
  );
  assert.equal(
    await page.getByLabel('PRA', { exact: true }).locator('option').count(),
    714,
  );
  const payload = await page.request.get(
    `${base}/api/national?action=day&date=2026-10-18`,
  );
  assert.equal(payload.status(), 200);
  const actual = await payload.json();
  assert.equal(actual.data.length, 713);
  assert.equal(new Set(actual.data.map((r) => r.id)).size, 713);
  const counts = actual.data.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    return a;
  }, {});
  assert.deepEqual(counts, { available: 645, partial: 67, unavailable: 1 });
  report.day_states = counts;
  const full = actual.data.find((r) => r.id === 'pra:28341'),
    partial = actual.data.find((r) => r.status === 'partial'),
    crozon = actual.data.find((r) => r.id === 'pra:29102');
  assert.ok(full && partial && crozon);
  for (const row of [full, partial, crozon]) {
    mark = Date.now();
    await page
      .getByLabel('Rechercher une PRA', { exact: true })
      .fill(row.id.slice(4));
    await page.getByLabel('PRA', { exact: true }).selectOption(row.id);
    await page
      .locator('#pra-history tbody tr')
      .last()
      .waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#pra-history tbody tr').count(), 30);
    const expectedState = row.status === 'available' ? 'complete' : row.status;
    const box = await page.locator('.national-map').boundingBox();
    let hovered = false;
    for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
        const hover = await page.locator('.national-hover').innerText();
        if (hover.includes(row.id.slice(4)) && hover.includes(expectedState)) {
          hovered = true;
          await page.mouse.click(
            box.x + box.width * fx,
            box.y + box.height * fy,
          );
          break;
        }
      }
      if (hovered) break;
    }
    assert.ok(hovered, `Rendered polygon hover/state missing: ${row.id}`);
    await page
      .locator('#pra-history tbody tr')
      .last()
      .waitFor({ timeout: 60000 });
    const text = await page.locator('#pra-diagnostic').innerText();
    assert.ok(
      text.includes(row.status === 'available' ? 'complete' : row.status),
    );
    assert.ok(text.includes('ERA5-Land'));
    assert.ok(text.includes('stale'));
    for (const k of [
      'temperature',
      'temperature_min',
      'temperature_max',
      'precipitation',
    ])
      if (row[k] === null) assert.ok(text.includes('NULL · indisponible'));
    assert.ok(page.url().includes(encodeURIComponent(row.id)));
    report.cases.push({
      pra: row.id,
      status: row.status,
      selection_history_ms: Date.now() - mark,
      rows: 30,
      nulls_preserved: true,
      rendered_hover_and_click: true,
    });
  }
  await page.getByLabel('Rechercher une PRA', { exact: true }).fill('28341');
  await page.getByLabel('PRA', { exact: true }).selectOption(full.id);
  await page
    .locator('#pra-history tbody tr')
    .last()
    .waitFor({ timeout: 60000 });
  await page
    .locator('#pra-history')
    .getByRole('button', { name: '2026-10-18', exact: true })
    .click();
  await page
    .getByText('complete · 645', { exact: true })
    .waitFor({ timeout: 60000 });
  report.same_date_reselection_preserves_data = true;
  mark = Date.now();
  await page.getByLabel('Date UTC', { exact: true }).fill('2026-09-30');
  await page
    .getByText('complete · 645', { exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .locator('#pra-diagnostic')
    .getByText(/Date UTC : 2026-09-30/)
    .waitFor();
  report.date_change_ms = Date.now() - mark;
  await page
    .getByRole('button', { name: 'Vue nationale · 713 PRA', exact: true })
    .click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .getByLabel('Variable', { exact: true })
      .selectOption('precipitation');
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.addScriptTag({ path: axe.resolve('axe-core/axe.min.js') });
    const violations = await page.evaluate(
      async () =>
        (
          await window.axe.run(document.querySelector('main'), {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })
        ).violations,
    );
    assert.deepEqual(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    if (width !== 768)
      await page.screenshot({
        path: `${dir}/national-${width}.png`,
        fullPage: true,
      });
    report.viewports.push({ width, axe: 0, no_overflow: true, contours: 713 });
  }
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.name.includes('pra-national.geojson'))
      .map((r) => ({
        transfer_size: r.transferSize,
        decoded_bytes: r.decodedBodySize,
        encoded_bytes: r.encodedBodySize,
        duration_ms: r.duration,
      })),
  );
  report.geometry = resources;
  await page.goto(`${base}/territories?date=2026-09-30&pra=pra%3A28341`, {
    waitUntil: 'domcontentloaded',
  });
  await page
    .getByText('complete · 645', { exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .locator('.national-map[data-ready="true"]')
    .waitFor({ timeout: 60000 });
  report.geometry_repeat_transfer_bytes = await page.evaluate(
    () =>
      performance
        .getEntriesByType('resource')
        .find((r) => r.name.includes('pra-national.geojson')).transferSize,
  );
  report.geometry_requested_once_per_workspace = resources.length === 1;
  assert.ok(report.geometry_requested_once_per_workspace);
  await page.getByLabel('Date UTC', { exact: true }).fill('');
  await page
    .getByRole('alert')
    .filter({ hasText: 'Sélectionnez une date' })
    .waitFor();
  assert.ok(
    !(await page.locator('#pra-diagnostic').innerText()).includes(
      'Date UTC : 2026-09-30',
    ),
  );
  report.missing_date_explicit = true;
  await page.route('**/api/national?action=day*', (r) => r.abort('failed'));
  await page.getByLabel('Date UTC', { exact: true }).fill('2026-10-18');
  await page.getByRole('alert').filter({ hasText: 'Erreur réseau' }).waitFor();
  assert.ok(
    !(await page.locator('#pra-diagnostic').innerText()).includes(
      'Date UTC : 2026-10-18',
    ),
  );
  report.simulated_network_failure_explicit = true;
  await page.unroute('**/api/national?action=day*');
  await page
    .getByRole('button', { name: 'Réessayer', exact: true })
    .first()
    .click();
  await page
    .getByText('complete · 645', { exact: true })
    .waitFor({ timeout: 60000 });
  report.retry_recovers = true;
  assert.deepEqual(report.errors, []);
  report.no_demo_fallback = true;
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
