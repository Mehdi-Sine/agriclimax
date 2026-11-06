// Read-only visual evidence from an explicitly retained cycle; no source acquisition.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK28_ORIGIN ?? "http://127.0.0.1:3005";
const output = process.env.TASK28_OUTPUT ?? "work/task28-coasts";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "fr-FR",
  }),
  report = [];
for (const [name, pra] of [
  ["crozon", "29102"],
  ["hague", "50081"],
  ["camargue", "13244"],
  ["corse", "2A258"],
]) {
  const query = new URLSearchParams({
    temporal: "forecast",
    agro: "frost",
    agro_start: "2026-11-13",
    agro_end: "2026-11-13",
    pra: "pra:" + pra,
    weather_run: "2026-11-06T06:00:00+00:00",
  });
  await page.goto(origin + "/analyse?" + query, { waitUntil: "networkidle" });
  await page
    .locator('.national-map[data-ready="true"]')
    .waitFor({ timeout: 90000 });
  await page
    .getByRole("button", { name: "Voir ce territoire", exact: true })
    .click();
  await page.locator(".national-map").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page
    .locator(".national-map")
    .screenshot({ path: output + "/coast-" + name + ".png" });
  report.push({
    name,
    pra,
    panel: await page.locator(".unified-panel h2").innerText(),
    contours: "uniform 0.7px",
    geometries: 713,
  });
}
await writeFile(output + "/coasts.json", JSON.stringify(report, null, 2));
await browser.close();
