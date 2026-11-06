// Demonstrate an actually calculable THI from the current verified national cycle.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK28_ORIGIN ?? "http://127.0.0.1:3005",
  output = process.env.TASK28_OUTPUT ?? "work/task28-thi";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext(),
  page = await context.newPage({ viewport: { width: 1440, height: 1000 } });
const catalogue = await (
  await context.request.get(
    origin + "/api/operational?experimental=weather&catalogue=1",
  )
).json();
const date = new Date(Date.parse(catalogue.run.slice(0, 10)) + 86400000)
  .toISOString()
  .slice(0, 10);
const params = new URLSearchParams({
  indicator: "thi",
  temporal: "forecast",
  start: date,
  end: date,
  run: catalogue.run,
});
const map = await (
    await context.request.get(origin + "/api/agroclimatic?" + params)
  ).json(),
  expected = map.data.find((r) => r.value !== null);
if (!expected)
  throw new Error(
    "No calculable THI in current cycle; do not fabricate coverage",
  );
const query = new URLSearchParams({
  production: "cattle",
  agro: "thi",
  temporal: "forecast",
  agro_start: date,
  agro_end: date,
  pra: expected.territoryId,
  weather_run: catalogue.run,
});
const response = page.waitForResponse(
  (r) => r.url().includes("/api/agroclimatic?") && r.ok(),
);
await page.goto(origin + "/analyse?" + query, { waitUntil: "networkidle" });
const d = await (await response).json();
const value = d.data.find((r) => r.territoryId === expected.territoryId).value;
if (value !== expected.value) throw new Error("Inconsistent cycle value");
await page
  .locator(".unified-value strong")
  .filter({
    hasText: new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 2,
    }).format(value),
  })
  .waitFor();
await page
  .locator('.national-map[data-ready="true"]')
  .waitFor({ timeout: 90000 });
await page.screenshot({
  path: output + "/desktop-thi-available.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: output + "/mobile-thi-available.png",
  fullPage: true,
});
await writeFile(
  output + "/thi-available.json",
  JSON.stringify(
    {
      pra: expected.territoryId,
      value,
      matched: true,
      provenance: expected.provenance,
      run: d.run,
      period: d.period,
    },
    null,
    2,
  ),
);
await browser.close();
