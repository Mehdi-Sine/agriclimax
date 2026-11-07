// Real archives only; no synthetic edition is served to the browser.
import { chromium } from "../../../../../tests/e2e/node_modules/playwright/index.mjs";
import { protectTask30Preview } from "../../../../../tests/e2e/task30-preview.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK32_ORIGIN ?? "http://localhost:3000";
const selected = new URL(origin);
if (
  !(
    ["localhost", "127.0.0.1"].includes(selected.hostname) ||
    (selected.protocol === "https:" &&
      selected.hostname.endsWith(".vercel.app"))
  )
)
  throw new Error("Unsupported preview origin");
const output = process.env.TASK32_OUTPUT ?? "docs/codex/task32/evidence/local";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const report = {
  origin,
  tested_commit: process.env.TASK32_COMMIT ?? null,
  transport: origin.startsWith("https://")
    ? "Cloud Node fetch route (decoded response sizes)"
    : "native browser",
  checks: [],
  errors: [],
  measurements: [],
};
const check = (name, ok) => {
  report.checks.push({ name, ok });
  if (!ok) throw Error(name);
};
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    await protectTask30Preview(context, origin);
    const page = await context.newPage();
    await page.addInitScript(() => {
      new PerformanceObserver((list) => {
        window.journalLcp = list.getEntries().at(-1)?.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    const response = await page.goto(origin + "/journal", {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    check(name + " HTTP 200", response.status() === 200);
    check(
      name + " real headline",
      (await page.locator("#headline").count()) === 1,
    );
    await page.locator(".journal-map svg").waitFor();
    check(
      name + " map",
      (await page.locator(".journal-map svg").count()) === 1,
    );
    check(
      name + " no overflow",
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      name + " thirteen regional comparisons",
      (await page.locator(".regional-chart li").count()) === 13,
    );
    await page.keyboard.press("Tab");
    check(
      name + " keyboard",
      await page.evaluate(() => document.activeElement !== document.body),
    );
    await page.locator("#headline").click();
    await page.screenshot({ path: `${output}/${name}-hero.png` });
    await page.screenshot({
      path: `${output}/${name}-full.png`,
      fullPage: true,
    });
    report.measurements.push({
      name,
      ...(await page.evaluate(() => ({
        lcpMs: window.journalLcp ?? null,
        paints: performance
          .getEntriesByType("paint")
          .map((p) => ({ name: p.name, ms: p.startTime })),
        navigation: performance.getEntriesByType("navigation")[0].toJSON(),
        jsBytes: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes(".js"))
          .reduce((s, r) => s + r.encodedBodySize, 0),
        geoRequests: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes(".geojson")).length,
      }))),
    });
    await page.locator(".key-facts a").first().click();
    check(
      name + " numbered proof reachable",
      (await page.locator("footer details").first().getAttribute("open")) !==
        null,
    );
    await page.getByText("Consulter les 13 régions", { exact: true }).click();
    check(
      name + " regions accessible",
      (await page.locator(".all-regions .region-story").count()) === 13,
    );
    await page.goto(origin + "/journal?run=2026-11-06", {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    check(
      name + " archived edition",
      await page
        .locator(".edition-strip")
        .innerText()
        .then((t) => t.includes("6 novembre 2026")),
    );
    await context.close();
  }
  check("no browser errors", report.errors.length === 0);
} catch (e) {
  report.failure = e.message;
  process.exitCode = 1;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
