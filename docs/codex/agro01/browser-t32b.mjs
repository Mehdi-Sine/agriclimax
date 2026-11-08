// Read-only acceptance against real archives; run after building and starting Next.
import { chromium } from '../../../tests/e2e/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin = process.env.AGRO01_ORIGIN ?? 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const output = 'docs/codex/agro01/evidence/t32b/wheat';
await mkdir(output, { recursive: true });
const report = { origin, synthetic: false, checks: [], errors: [], cycles: [] };
const check = (name, value) => { report.checks.push({ name, ok: !!value }); assert(value, name); };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const requested of [null, '2026-11-06T00:00:00Z']) {
    const query = requested ? '?run=' + encodeURIComponent(requested) : '';
    const response = await fetch(origin + '/api/journal' + query);
    check('Journal API 200 ' + requested, response.status === 200);
    const edition = await response.json();
    const watch = await (await fetch(origin + '/api/veille?run=' + encodeURIComponent(edition.source_cycles[0]))).json();
    const wheat = edition.production_sections.find(p => p.id === 'wheat');
    check('ten available qualified wheat indicators ' + requested, wheat.indicators.length === 10 && wheat.indicators.every(i => i.status === 'available' && i.qualified && i.publishable));
    const facts = wheat.indicators.flatMap(i => i.facts);
    check('all wheat facts in evidence ' + requested, facts.every(f => edition.evidence.facts.some(e => e.id === f.id && JSON.stringify(e) === JSON.stringify(f))));
    check('periods contained in edition and exact analysis links ' + requested, wheat.indicators.every(i => i.facts.every(f => {
      const u = new URL(f.href, origin);
      return i.period[0] >= watch.period[0] && i.period[1] <= watch.period[1] && JSON.stringify(f.period) === JSON.stringify(i.period) && u.searchParams.get('agro_start') === i.period[0] && u.searchParams.get('agro_end') === i.period[1] && u.searchParams.get('weather_run') === edition.source_cycles[0] && u.searchParams.get('pra')?.startsWith('pra:');
    })));
    check('seven-day unavailable inventory preserved ' + requested, wheat.indicator_inventory.some(i => i.status === 'unavailable' && !i.publishable && !i.facts.length));
    const repeated = await fetch(origin + '/api/journal' + query, { headers: { 'if-none-match': response.headers.get('etag') } });
    check('stable Journal ETag ' + requested, repeated.status === 304);
    report.cycles.push({ run: edition.source_cycles[0], edition: edition.edition_id, wheatIndicators: wheat.indicators.length, facts: facts.length, periods: [...new Set(wheat.indicators.map(i => i.period.join('/')))], unavailable: wheat.indicator_inventory.filter(i => i.status !== 'available').map(i => ({ id: i.id, period: i.period, status: i.status })) });
    for (const [name, width, height] of [['desktop',1440,1000], ['mobile',390,844]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(origin + '/journal' + query, { waitUntil: 'networkidle', timeout: 90000 });
      const card = page.locator('.production-story').filter({ has: page.getByRole('heading', { name: 'Blé tendre', exact: true }) });
      await card.waitFor();
      const paragraphs = await card.locator(':scope > p').allTextContents();
      check(name + ' every qualified fact visible ' + requested, facts.every(f => paragraphs.some(p => p.includes(f.text.split(', du ')[0]))));
      check(name + ' descriptive reserves and French dates ' + requested, !(await card.innerText()).match(/\b\d{4}-\d{2}-\d{2}\b/) && (await card.innerText()).includes('aucun stade, dommage ou rendement déduit'));
      await card.evaluate(e => e.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${output}/${name}-${requested ? 'archived' : 'current'}-integration.png` });
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: `${output}/${name}-${requested ? 'archived' : 'current'}-wheat.png` });
      await card.getByText('Contexte et disponibilité', { exact: true }).click();
      check(name + ' unavailable inventory accessible ' + requested, (await card.innerText()).includes('unavailable'));
      const sourceDetails = page.locator('#sources > details');
      await sourceDetails.locator(':scope > summary').click();
      for (const f of facts) {
        const reference = page.locator('#reference-' + f.id);
        check(name + ' proof reference ' + f.id, await reference.count() === 1);
      }
      const reference = page.locator('#reference-' + facts[0].id);
      await reference.getByText('Traçabilité du fait', { exact: true }).click();
      check(name + ' rule and provenance visible ' + requested, (await reference.innerText()).includes(facts[0].rule_version) && (await reference.innerText()).includes(facts[0].provenance[0]));
      await reference.screenshot({ path: `${output}/${name}-${requested ? 'archived' : 'current'}-proof.png` });
      check(name + ' no overflow ' + requested, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.close();
    }
  }
  check('no browser page errors', report.errors.length === 0);
} catch (e) { report.failure = e.message; process.exitCode = 1; }
finally { await writeFile(output + '/report.json', JSON.stringify(report, null, 2)); await browser.close(); }
