import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const origin = process.env.AGRO06_ORIGIN ?? "http://127.0.0.1:3019";
const out = process.env.AGRO06_EVIDENCE ?? "work/agro06/browser";
const start = "2026-11-10", end = "2026-11-16";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const checks = [];
try {
  for (const { agro, width, crop, pra, unit } of [
    { agro: "wet_intensity1", width: 1440, crop: "cereals", unit: "mm/j humide" },
    { agro: "wet_sequence1", width: 390, crop: "forage", pra: "pra:29102", unit: "jours" },
    { agro: "ice_days", width: 1440, crop: "vine", unit: "jours" },
    { agro: "warm_nights20", width: 390, crop: "cattle", unit: "jours" },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, locale: "fr-FR" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const query = new URLSearchParams({
      production: "field", agro, agro_crop: crop, agro_start: start, agro_end: end,
      ...(pra ? { pra } : {}),
    });
    const api = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/agroclimatic" && url.searchParams.get("indicator") === agro;
    }, { timeout: 120000 });
    const [response] = await Promise.all([
      api,
      page.goto(`${origin}/analyse?${query}`, { waitUntil: "domcontentloaded", timeout: 120000 }),
    ]);
    assert.equal(response.status(), 200, await response.text());
    const payload = await response.json();
    assert.equal(payload.data.length, 713);
    assert.equal(payload.data.filter(row => /^pra:2[AB]/.test(row.territoryId)).length, 6);
    assert.equal(payload.rule.unit, unit);
    const map = page.locator('.national-map[data-ready="true"]');
    await map.waitFor({ timeout: 120000 });
    await page.locator(".map-updating").waitFor({ state: "hidden", timeout: 120000 });
    assert.equal(await map.getAttribute("data-rendered-contour-count"), "713");
    assert.equal(await page.getByLabel("Filière", { exact: true }).inputValue(), crop);
    assert.equal(await page.getByLabel("Indicateur", { exact: true }).inputValue(), agro);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    if (pra) {
      const selected = payload.data.find(row => row.territoryId === pra);
      assert.equal(selected.value, null);
      assert.equal(selected.observed_value, null);
      assert.match(await page.getByRole("complementary", { name: "Fiche territoire" }).innerText(), /Indisponible/);
    }
    await page.getByRole("region", { name: "Exploration cartographique" })
      .screenshot({ path: join(out, `${width}-${agro}.png`) });
    const support = await map.evaluate(node => ({ ...node.dataset }));
    if (agro === "wet_intensity1") {
      const method = page.getByText("Méthode et références scientifiques", { exact: true });
      await method.click();
      const summary = page.getByRole("region", { name: "Synthèse nationale agroclimatique" });
      assert.ok(await summary.getByRole("link", { name: /définitions des indices climatiques/ }).isVisible());
      await summary.screenshot({ path: join(out, "1440-methode.png") });
      const exportHref = await summary.getByRole("link", { name: /Exporter la synthèse/ }).getAttribute("href");
      const result = await page.request.get(new URL(exportHref, origin).href);
      assert.equal(result.status(), 200, await result.text());
      const exported = await result.json();
      assert.equal(exported.indicator, agro);
      assert.equal(exported.total_pra, 713);
      assert.ok(exported.map.startsWith("/analyse?"));
      assert.equal(Object.hasOwn(exported, "data"), false);
      await page.getByLabel("Filière", { exact: true }).selectOption("cattle");
      await page.waitForURL(url => url.searchParams.get("agro_crop") === "cattle");
      const indicator = page.getByLabel("Indicateur", { exact: true });
      await indicator.locator('option[value="warm_nights20"]').waitFor({ state: "attached" });
      assert.equal(await indicator.inputValue(), "warm_nights20");
    }
    assert.deepEqual(errors, []);
    checks.push({ agro, width, crop, pra, support });
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(join(out, "browser.json"), JSON.stringify({ checks }, null, 2) + "\n");
}
