// Preview UI acceptance of every rule; reads existing APIs, no offline replay or acquisition.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK28_ORIGIN ?? "http://127.0.0.1:3100";
const output = process.env.TASK28_OUTPUT ?? "work/task28-portfolio";
await mkdir(output, { recursive: true });
const groups = {
  wheat: [
    "gdd",
    "hot",
    "hot_sequence",
    "frost",
    "frost_sequence",
    "rain",
    "heavy_rain",
    "dry",
    "dry_sequence",
  ],
  cattle: ["thi", "thi_days", "thi_sequence", "cattle_heat"],
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const report = {
  origin,
  checks: [],
  errors: [],
  noOfflineNationalReplay: true,
  noAcquisitions: true,
};
try {
  for (const [viewport, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1000],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height },
        locale: "fr-FR",
        hasTouch: viewport === "mobile",
      }),
      page = await context.newPage();
    page.on("pageerror", (e) =>
      report.errors.push({ viewport, message: e.message }),
    );
    const initial = page.waitForResponse(
      (r) => r.url().includes("/api/agroclimatic?indicator=gdd&") && r.ok(),
      { timeout: 120000 },
    );
    await page.goto(origin + "/analyse?temporal=forecast&pra=pra%3A05231", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await initial;
    await page
      .locator('.national-map[data-ready="true"]')
      .waitFor({ timeout: 90000 });
    await page.evaluate(
      () =>
        (window.__portfolioCanvas = document.querySelector(
          ".national-map canvas",
        )),
    );
    for (const [production, ids] of Object.entries(groups)) {
      if (production === "cattle") {
        const loading = page.waitForResponse(
          (r) => r.url().includes("/api/agroclimatic?indicator=thi&") && r.ok(),
          { timeout: 120000 },
        );
        await page
          .getByRole("combobox", { name: "Production", exact: true })
          .selectOption("cattle");
        await loading;
      }
      for (const id of ids) {
        let response;
        if (
          (await page
            .getByRole("combobox", { name: "Indicateur", exact: true })
            .inputValue()) === id
        ) {
          // Read the current UI's exact request from its URL-derived dates.
          const dates = await page
            .locator("input[type=date]")
            .evaluateAll((inputs) => inputs.map((i) => i.value));
          response = await context.request.get(
            origin +
              "/api/agroclimatic?" +
              new URLSearchParams({
                indicator: id,
                temporal: "forecast",
                start: dates[0],
                end: dates[1],
                pra: "pra:05231",
              }),
          );
        } else {
          const loading = page.waitForResponse(
            (r) =>
              r.url().includes("/api/agroclimatic?indicator=" + id + "&") &&
              r.ok(),
            { timeout: 120000 },
          );
          await page
            .getByRole("combobox", { name: "Indicateur", exact: true })
            .selectOption(id);
          response = await loading;
        }
        const payload = await response.json(),
          row = payload.data.find((r) => r.territoryId === "pra:05231");
        if (payload.rule.id !== id || payload.data.length !== 713)
          throw new Error("WRONG_RULE_OR_COVERAGE");
        const label =
          row.value === null
            ? "Indisponible"
            : new Intl.NumberFormat("fr-FR", {
                maximumFractionDigits: 2,
              }).format(row.value);
        await page
          .locator(".unified-value strong")
          .filter({ hasText: label })
          .waitFor({ timeout: 120000 });
        await page
          .locator(".unified-map-title strong")
          .filter({ hasText: payload.rule.label })
          .waitFor();
        if (
          !(await page.evaluate(
            () =>
              window.__portfolioCanvas ===
              document.querySelector(".national-map canvas"),
          ))
        )
          throw new Error("CANVAS_RECREATED");
        if (
          (await page
            .getByRole("combobox", { name: "PRA", exact: true })
            .inputValue()) !== "pra:05231"
        )
          throw new Error("PRA_LOST");
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw new Error("OVERFLOW");
        report.checks.push({
          viewport,
          production,
          indicator: id,
          unit: payload.rule.unit,
          period: payload.period,
          pra: "pra:05231",
          value: row.value,
          apiPanelMatch: true,
          sameCanvas: true,
          officialFeatures: 713,
        });
      }
    }
    const recent = page.waitForResponse(
      (r) =>
        r.url().includes("/api/agroclimatic?") &&
        r.url().includes("temporal=recent") &&
        r.ok(),
      { timeout: 120000 },
    );
    await page
      .getByRole("combobox", { name: "Temporalité", exact: true })
      .selectOption("recent");
    const d = await (await recent).json();
    await page
      .locator(".unified-map-title")
      .filter({ hasText: "Estimation" })
      .waitFor();
    report.checks.push({
      viewport,
      temporal: "recent",
      source: d.temporal,
      notLabelledObservation: true,
    });
    await page.keyboard.press("Tab");
    if (!(await page.evaluate(() => document.activeElement !== document.body)))
      throw new Error("NO_KEYBOARD_FOCUS");
    await context.close();
  }
  if (report.errors.length) throw new Error(JSON.stringify(report.errors));
  await writeFile(output + "/portfolio.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ cases: report.checks.length, errors: report.errors }),
  );
} finally {
  await browser.close();
}
