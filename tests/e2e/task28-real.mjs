// Real application acceptance: no mocked responses, clock changes or source acquisitions.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK28_ORIGIN ?? "http://127.0.0.1:3003";
const output = process.env.TASK28_OUTPUT ?? "work/task28-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const report = { origin, checks: [], screenshots: [], errors: [] };
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1000],
  ["mobile", 390, 844],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: name === "mobile",
    hasTouch: name === "mobile",
    locale: "fr-FR",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push({ name, error: e.message }));
  let payload;
  async function check(response) {
    payload = await response.json();
    const expected = payload.data.find((r) => r.territoryId === "pra:28341");
    const formatted =
      expected.value === null
        ? "Indisponible"
        : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
            expected.value,
          );
    await page
      .locator(".unified-panel .unified-value strong")
      .filter({ hasText: formatted })
      .waitFor({ timeout: 120000 });
    report.checks.push({
      name,
      indicator: payload.rule.id,
      period: payload.period,
      value: expected.value,
      matched: true,
    });
  }
  async function act(action, id, extra = "") {
    const next = page.waitForResponse(
      (r) =>
        r.url().includes("/api/agroclimatic?indicator=" + id + "&") &&
        r.url().includes(extra) &&
        r.ok(),
      { timeout: 120000 },
    );
    await action();
    await check(await next);
  }
  const first = page.waitForResponse(
    (r) => r.url().includes("/api/agroclimatic?indicator=gdd&") && r.ok(),
    { timeout: 120000 },
  );
  await page.goto(origin + "/analyse?pra=pra:28341", {
    waitUntil: "networkidle",
  });
  await check(await first);
  await page
    .locator('.national-map[data-ready="true"]')
    .waitFor({ timeout: 90000 });
  report.checks.push({
    name,
    initialReady_ms: await page.evaluate(() => performance.now()),
    resources: await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter(
          (r) =>
            r.name.includes("/maps/") || r.name.includes("/api/agroclimatic"),
        )
        .map((r) => ({
          name: new URL(r.name).pathname,
          duration_ms: r.duration >= 0 ? r.duration : null,
          timing_valid: r.duration >= 0,
          bytes: r.transferSize,
        })),
    ),
  });
  await page.evaluate(() => {
    window.__task28Canvas = document.querySelector(".national-map canvas");
  });
  await page.screenshot({
    path: `${output}/${name}-wheat.png`,
    fullPage: true,
  });
  await page.locator(".national-map").scrollIntoViewIfNeeded();
  await page
    .locator(".national-map")
    .screenshot({ path: `${output}/${name}-map.png` });
  await act(
    () =>
      page
        .getByRole("combobox", { name: "Indicateur", exact: true })
        .selectOption("hot"),
    "hot",
  );
  await act(
    () =>
      page
        .getByRole("combobox", { name: "Temporalité", exact: true })
        .selectOption("forecast"),
    "hot",
    "temporal=forecast",
  );
  await act(
    () =>
      page
        .getByRole("combobox", { name: "Indicateur", exact: true })
        .selectOption("frost"),
    "frost",
  );
  await act(
    () => page.getByRole("button", { name: "J+7", exact: true }).click(),
    "frost",
  );
  await act(
    () =>
      page
        .getByRole("combobox", { name: "Production", exact: true })
        .selectOption("cattle"),
    "thi",
  );
  if (
    (await page
      .getByRole("combobox", { name: "PRA", exact: true })
      .inputValue()) !== "pra:28341"
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
  await act(
    () =>
      page
        .getByRole("button", {
          name: "Prochaine semaine · séries",
          exact: true,
        })
        .click(),
    "thi",
  );
  await page
    .locator(".unified-panel")
    .filter({ hasText: "Cumul refusé" })
    .waitFor();
  const share = page.url();
  const reload = page.waitForResponse(
    (r) => r.url().includes("/api/agroclimatic?indicator=thi&") && r.ok(),
    { timeout: 120000 },
  );
  await page.reload({ waitUntil: "networkidle" });
  await check(await reload);
  await page
    .locator('.national-map[data-ready="true"]')
    .waitFor({ timeout: 90000 });
  if (
    page.url() !== share ||
    (await page
      .getByRole("combobox", { name: "Production", exact: true })
      .inputValue()) !== "cattle"
  )
    throw new Error("SHARE_STATE_LOST");
  await page.getByRole("link", { name: "Climat", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  if (new URL(page.url()).searchParams.get("pra") !== "pra:28341")
    throw new Error("CLIMATE_PRA_LOST");
  await page
    .getByRole("link", { name: "Productions agricoles", exact: true })
    .click();
  await page.waitForURL("**/productions?*");
  if (new URL(page.url()).searchParams.get("pra") !== "pra:28341")
    throw new Error("AGRICULTURE_PRA_LOST");
  await page.keyboard.press("Tab");
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
