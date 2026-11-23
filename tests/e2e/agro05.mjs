import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const origin = process.env.AGRO05_ORIGIN ?? "http://localhost:3018";
const out = process.env.AGRO05_EVIDENCE ?? "work/agro05/browser";
const start = "2026-11-10";
const end = "2026-11-16";
const ids = ["field_maize_gdd", "field_frost", "field_dry_sequence", "field_antecedent_rain", "field_peak_rain5"];
const cases = [
  ...ids.map(id => ({ id, width: 1440 })),
  { id: "field_peak_rain5", width: 768 },
  { id: "field_antecedent_rain", width: 390, pra: "pra:29102" },
];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const checks = [];
const pageErrors = [];
try {
  for (const { id, width, pra } of cases) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, locale: "fr-FR" });
    page.on("pageerror", error => pageErrors.push(error.message));
    const query = new URLSearchParams({ production: "field", agro: id, agro_start: start, agro_end: end, ...(pra ? { pra } : {}) });
    const api = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/agroclimatic" && url.searchParams.get("indicator") === id;
    }, { timeout: 120000 });
    const began = performance.now();
    await page.goto(`${origin}/analyse?${query}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const response = await api;
    assert.equal(response.status(), 200, await response.text());
    const payload = await response.json();
    assert.equal(payload.data.length, 713);
    const map = page.locator('.national-map[data-ready="true"]');
    await map.waitFor({ timeout: 120000 });
    await page.locator(".map-updating").waitFor({ state: "hidden", timeout: 120000 });
    assert.equal(await map.getAttribute("data-rendered-contour-count"), "713");
    assert.ok(await page.getByLabel("Légende quantitative").count());
    assert.match(await page.locator(".unified-map-title").innerText(), /ERA5-Land/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    if (pra) {
      assert.equal(payload.data.find(row => row.territoryId === pra)?.value, null);
      const panel = page.getByRole("complementary", { name: "Fiche territoire" });
      assert.match(await panel.innerText(), /indisponible|indisponibles/i);
      await panel.screenshot({ path: join(out, "390-crozon-fiche.png") });
    }
    await page.getByRole("region", { name: "Exploration cartographique" })
      .screenshot({ path: join(out, `${width}-${id}.png`) });
    const support = await map.evaluate(element => ({...element.dataset}));
    if (id === "field_peak_rain5" && width === 1440) {
      const exportLink = page.getByRole("link", { name: "Exporter la synthèse pour le Journal (JSON)" });
      const exported = await page.request.get(`${origin}${await exportLink.getAttribute("href")}`);
      assert.equal(exported.status(), 200);
      const summary = await exported.json();
      assert.equal(summary.indicator, id);
      assert.equal(summary.total_pra, 713);
      assert.ok(summary.evolution.paired_pra > 0);
      assert.equal(summary.distribution.reduce((sum, bucket) => sum + bucket.count, 0), summary.evaluable_pra);
      // Switch by keyboard from the production selector and check the priority filter is reachable.
      const production = page.getByRole("combobox", { name: "Production", exact: true });
      await production.focus();
      await page.keyboard.press("ArrowDown");
      await page.getByRole("combobox", { name: "Indicateur", exact: true }).locator('option[value="gdd"]').waitFor({ state: "attached" });
    }
    checks.push({ id, width, pra, elapsed_ms: Math.round(performance.now() - began), support });
    await page.close();
  }
  assert.deepEqual(pageErrors, []);
} finally {
  await browser.close();
  await writeFile(join(out, "browser.json"), JSON.stringify({ checks, pageErrors }, null, 2) + "\n");
}
