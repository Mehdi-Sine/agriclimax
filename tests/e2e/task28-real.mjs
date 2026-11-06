// Real application acceptance: no mocked responses, clock changes or source acquisitions.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK28_ORIGIN ?? "http://127.0.0.1:3002";
const output = process.env.TASK28_OUTPUT ?? "work/task28-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const report = { origin, checks: [], screenshots: [], errors: [] };
const api = await browser.newContext();
const catalogue = await (
  await api.request.get(
    origin + "/api/operational?experimental=weather&catalogue=1",
  )
).json();
const day = new Date(Date.parse(catalogue.run.slice(0, 10)) + 86400000)
  .toISOString()
  .slice(0, 10);
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1000],
  ["mobile", 390, 844],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: name === "mobile",
    hasTouch: name === "mobile",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push({ name, error: e.message }));
  let payload = null;
  page.on("response", async (response) => {
    if (response.url().includes("/api/agroclimatic?") && response.ok())
      payload = await response.json();
  });
  await page.goto(origin + "/analyse?pra=pra:28341", {
    waitUntil: "networkidle",
  });
  await page
    .locator('.national-map[data-ready="true"]')
    .waitFor({ timeout: 90000 });
  await page.waitForFunction(
    () =>
      document.querySelector(".unified-source-state") ||
      document.body.innerText.includes("/713 PRA avec un résultat complet"),
    { timeout: 120000 },
  );
  await page.locator(".unified-panel .unified-value strong").waitFor();
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".unified-panel .unified-value strong")
        ?.textContent?.includes("Indisponible"),
    { timeout: 120000 },
  );
  await page.evaluate(() => {
    window.__task28Canvas = document.querySelector(".national-map canvas");
  });
  const assertValue = async () => {
    if (!payload) throw new Error("NO_REAL_PAYLOAD");
    const expected = payload.data.find((r) => r.territoryId === "pra:28341");
    const formatted =
      expected.value === null
        ? "Indisponible"
        : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
            expected.value,
          );
    const actual = await page
      .locator(".unified-panel .unified-value strong")
      .innerText();
    if (!actual.includes(formatted))
      throw new Error("PANEL_API_MISMATCH " + actual + " vs " + formatted);
    report.checks.push({
      name,
      indicator: payload.rule.id,
      value: expected.value,
      matched: true,
    });
  };
  await assertValue();
  await page.screenshot({
    path: `${output}/${name}-wheat.png`,
    fullPage: true,
  });
  await page.locator(".national-map").scrollIntoViewIfNeeded();
  await page
    .locator(".national-map")
    .screenshot({ path: `${output}/${name}-map.png` });
  await page.getByLabel("Indicateur", { exact: true }).selectOption("hot");
  await page.waitForResponse(
    (r) => r.url().includes("/api/agroclimatic?indicator=hot&") && r.ok(),
    { timeout: 120000 },
  );
  await page.waitForTimeout(200);
  await assertValue();
  await page
    .getByLabel("Temporalité", { exact: true })
    .selectOption("forecast");
  await page.waitForResponse(
    (r) =>
      r.url().includes("temporal=forecast") &&
      r.url().includes("/api/agroclimatic?") &&
      r.ok(),
    { timeout: 120000 },
  );
  await page.getByLabel("Indicateur", { exact: true }).selectOption("frost");
  await page.waitForResponse(
    (r) => r.url().includes("/api/agroclimatic?indicator=frost&") && r.ok(),
    { timeout: 120000 },
  );
  await page.getByRole("button", { name: "J+7", exact: true }).click();
  await page.waitForResponse(
    (r) => r.url().includes("/api/agroclimatic?indicator=frost&") && r.ok(),
    { timeout: 120000 },
  );
  await page.waitForTimeout(200);
  await assertValue();
  await page.getByLabel("Production", { exact: true }).selectOption("cattle");
  await page.waitForResponse(
    (r) => r.url().includes("/api/agroclimatic?indicator=thi&") && r.ok(),
    { timeout: 120000 },
  );
  await page.waitForTimeout(200);
  await assertValue();
  if (
    (await page.getByLabel("PRA", { exact: true }).inputValue()) !== "pra:28341"
  )
    throw new Error("PRA_LOST");
  if (
    !(await page.evaluate(
      () =>
        window.__task28Canvas ===
        document.querySelector(".national-map canvas"),
    ))
  )
    throw new Error("CANVAS_RECREATED");
  await page.screenshot({
    path: `${output}/${name}-cattle.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Prochaine semaine · séries", exact: true })
    .click();
  await page.waitForResponse(
    (r) => r.url().includes("/api/agroclimatic?indicator=thi&") && r.ok(),
    { timeout: 120000 },
  );
  await page.waitForTimeout(200);
  if (
    !(await page
      .locator(".unified-panel")
      .innerText()
      .then((t) => t.includes("Cumul refusé")))
  )
    throw new Error("MIXED_SOURCE_NOT_EXPLAINED");
  const share = page.url();
  await page.reload({ waitUntil: "networkidle" });
  await page
    .locator('.national-map[data-ready="true"]')
    .waitFor({ timeout: 90000 });
  if (
    page.url() !== share ||
    (await page.getByLabel("Production", { exact: true }).inputValue()) !==
      "cattle"
  )
    throw new Error("SHARE_STATE_LOST");
  await page.getByRole("link", { name: "Climat", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  if (
    !page.url().includes("pra=pra%3A28341") &&
    !page.url().includes("pra=pra:28341")
  )
    throw new Error("CLIMATE_PRA_LOST");
  await page
    .getByRole("link", { name: "Productions agricoles", exact: true })
    .click();
  await page.waitForURL("**/productions?*");
  if (!page.url().includes("28341")) throw new Error("AGRICULTURE_PRA_LOST");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw new Error("HORIZONTAL_OVERFLOW " + name);
  report.checks.push({
    name,
    sharedURL: share,
    praPersistent: true,
    sameCanvas: true,
    overflow: false,
  });
  report.screenshots.push(
    ...["wheat", "cattle", "map"].map((kind) => `${name}-${kind}.png`),
  );
  await context.close();
}
await writeFile(output + "/acceptance.json", JSON.stringify(report, null, 2));
await browser.close();
if (report.errors.length) throw new Error(JSON.stringify(report.errors));
console.log(JSON.stringify(report, null, 2));
