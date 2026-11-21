import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { coveragePaint } from '../../apps/web/features/cartography/coverage.ts';

const origin = process.env.COUV08_ORIGIN ?? 'http://127.0.0.1:3018';
const label = process.env.COUV08_LABEL ?? 'after';
const output = process.env.COUV08_OUTPUT ?? 'work/couv08/browser';
const timeout = 120_000;
const report = { origin, label, checks: [], archives: [], errors: [] };
const cases = [
  { id: 'temperature', url: '/climat?temporal=history&date=2026-11-01&start=2026-11-01&mode=value&indicateur=temperature', api: '/api/unified', counts: [681, 31, 1] },
  { id: 'rain', url: '/climat?temporal=history&date=2026-11-01&start=2026-11-01&mode=value&indicateur=rain', api: '/api/unified', counts: [681, 31, 1] },
  { id: 'thi', url: '/analyse?production=cattle&agro=thi&temporal=history&agro_start=2026-11-01&agro_end=2026-11-01', api: '/api/agroclimatic', counts: [0, 0, 713] },
];

const weatherRun = process.env.COUV08_WEATHER_RUN;
const scenarios = weatherRun ? ['arome', 'arpege', 'ifs'].map(model => {
  const params = new URLSearchParams({ temporal: 'forecast', weather_model: model, weather_run: weatherRun, weather_variable: 'temperature' });
  return { id: model, url: `/climat?${params}`, api: '/api/operational', weather: true };
}) : cases;

function countsForWeather(payload) {
  assert.ok(payload.forecast_support, 'La recette locale exige le transport des preuves natives');
  assert.equal(payload.run.slice(0, 10), weatherRun);
  const supports = new Map(payload.forecast_support.features.map(feature => [feature.id, feature.properties.support_id]));
  const { lookup, definitions } = payload.coverage_quality;
  const counts = { whole: 0, covered: 0, unavailable: 0 };
  for (const row of payload.rows) {
    const quality = definitions[lookup[`${row.pra_id}/${row.valid_date}/${row.variable}`]];
    const paint = coveragePaint({ value: row.value, quality, field: 'value', geometrySupportId: supports.get(row.pra_id) });
    counts[paint.target]++;
  }
  return Object.values(counts);
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const widths = process.env.COUV08_ARCHIVES_ONLY === "true" ? [] : [1440, 768, 390];
  for (const width of widths) {
    for (const item of scenarios) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'fr-FR' });
      try {
        const page = await context.newPage();
        page.on('pageerror', error => report.errors.push(error.message));
        const api = page.waitForResponse(response => {
          const url = new URL(response.url());
          return url.pathname === item.api && response.ok() &&
            (!item.weather || url.searchParams.get('model') === item.id && url.searchParams.has('date'));
        }, { timeout });
        const started = performance.now();
        await page.goto(origin + item.url, { waitUntil: 'domcontentloaded', timeout });
        const response = await api;
        const payload = await response.json();
        const apiMs = Math.round(performance.now() - started);
        const ids = (payload.data ?? payload.rows).map(row => row.territoryId ?? row.pra_id);
        assert.equal(new Set(ids).size, 713);
        assert.equal(ids.filter(id => /^pra:2[AB]/.test(id)).length, 6);
        const counts = item.weather ? countsForWeather(payload) : item.counts;
        const selector = `.national-map[data-ready="true"][data-rendered-contour-count="713"][data-whole-count="${counts[0]}"][data-covered-count="${counts[1]}"][data-unavailable-count="${counts[2]}"]`;
        await page.locator(selector).waitFor({ timeout });
        await page.locator('.map-updating').waitFor({ state: 'hidden', timeout });
        const readyMs = Math.round(performance.now() - started);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const legend = await page.locator('.semantic-legend').innerText();
        assert.match(legend, /Sous 90 %/);
        await page.locator('.national-map-wrap').screenshot({ path: `${output}/${label}-${width}-${item.id}.png` });
        report.checks.push({ width, indicator: item.id, counts, run: payload.run, date: payload.rows?.[0]?.valid_date, apiMs, readyMs, legend });
      } finally {
        await context.close();
      }
    }
  }
  if (process.env.COUV08_EDITION_ID) {
    const id = process.env.COUV08_EDITION_ID;
    const page = await browser.newPage();
    const metadata = await page.request.get(`${origin}/api/journal/maps?id=${id}`, { timeout });
    assert.equal(metadata.status(), 200);
    const { maps, status } = await metadata.json();
    assert.equal(status, 'published');
    assert.ok(maps.length > 0);
    for (const map of maps) {
      const query = new URLSearchParams({ id, map: map.id });
      const [data, thumb] = await Promise.all([
        page.request.get(`${origin}/api/journal/maps?${query}`, { timeout }),
        page.request.get(`${origin}/api/journal/thumbnail?${query}&v=ux03-1`, { timeout }),
      ]);
      assert.equal(data.status(), 200);
      assert.equal(thumb.status(), 200);
      assert.equal(thumb.headers()['content-type'], 'image/webp');
      const hash = async response => createHash('sha256').update(await response.body()).digest('hex');
      report.archives.push({ map: map.id, data: await hash(data), thumb: await hash(thumb) });
    }
    await page.goto(`${origin}/journal?id=${id}`, { waitUntil: 'domcontentloaded', timeout });
    const cards = page.locator('.journal-map-card');
    await cards.first().waitFor({ timeout });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.journal-thumbnail img')).every(image => image.complete && image.naturalWidth > 0), { timeout });
    await page.locator('.journal-map-carousel').screenshot({ path: `${output}/${label}-journal.png` });
    await cards.first().locator('a').first().click();
    await page.locator('.national-map[data-ready="true"][data-rendered-contour-count="713"]').waitFor({ timeout });
    await page.close();
    if (process.env.COUV08_ARCHIVE_BASELINE) {
      const baseline = JSON.parse(await readFile(process.env.COUV08_ARCHIVE_BASELINE, 'utf8'));
      assert.deepEqual(report.archives, baseline.archives);
    }
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/${label}.json`, JSON.stringify(report, null, 2) + '\n');
}
