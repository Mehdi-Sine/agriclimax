// Read-only UI/API acceptance of qualified historical coastal data. No mocked data.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK28_ORIGIN ?? "http://127.0.0.1:3012",
  output = process.env.TASK28_OUTPUT ?? "work/coastal-ui";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const report = { origin, checks: [], errors: [] },
  pras = ["28341", "06245", "06249", "29102"];
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
    const periods =
      viewport === "desktop"
        ? [
            ["day", "2026-10-31"],
            ["five", "2026-10-27"],
            ["seven", "2026-10-25"],
            ["thirty", "2026-10-02"],
          ]
        : [["day", "2026-10-31"]];
    for (const [period, start] of periods)
      for (const code of pras) {
        const ids =
          viewport === "desktop" && period === "day"
            ? ["gdd", "temperature_mean", "rain", "hot", "frost"]
            : ["gdd"];
        for (const id of ids) {
          const query = new URLSearchParams({
            pra: "pra:" + code,
            agro: id,
            temporal: "history",
            agro_start: start,
            agro_end: "2026-10-31",
          });
          const response = page.waitForResponse(
            (r) => {
              const url = new URL(r.url());
              return (
                url.pathname === "/api/agroclimatic" &&
                url.searchParams.get("indicator") === id &&
                url.searchParams.get("pra") === "pra:" + code &&
                url.searchParams.get("start") === start &&
                r.ok()
              );
            },
            { timeout: 180000 },
          );
          if (page.url() === "about:blank")
            await page.goto(origin + "/analyse?" + query, {
              waitUntil: "domcontentloaded",
              timeout: 180000,
            });
          else
            await page.evaluate(
              (path) => window.history.pushState(null, "", path),
              "/analyse?" + query,
            );
          const payload = await (await response).json(),
            r = payload.data.find((r) => r.territoryId === "pra:" + code);
          const value = r.value ?? r.observed_value,
            display =
              value == null
                ? "Indisponible"
                : new Intl.NumberFormat("fr-FR", {
                    maximumFractionDigits: 2,
                  }).format(value);
          await page
            .locator(".unified-value strong")
            .filter({ hasText: display })
            .waitFor({ timeout: 60000 });
          await page
            .locator('.national-map[data-ready="true"]')
            .waitFor({ timeout: 90000 });
          const expected =
            (period === "day" || period === "five") &&
            ["gdd", "temperature_mean", "rain"].includes(id)
              ? 67
              : 0;
          await page.waitForFunction(
            (n) =>
              Number(
                document.querySelector(".national-map")?.dataset
                  .coveredSupportCount,
              ) === n,
            expected,
            { timeout: 60000 },
          );
          const panel = await page.locator(".unified-panel").innerText();
          if (
            r.support_scope === "qualified_pra_estimate" &&
            !panel.includes("Estimation qualifiée")
          )
            throw new Error("QUALIFICATION_MISSING");
          if (
            r.support_scope === "observed_area" &&
            !panel.includes("portion renseignée uniquement")
          )
            throw new Error("PORTION_LABEL_MISSING");
          if (code === "29102" && !panel.includes("Absence de support ERA5"))
            throw new Error("CROZON_FABRICATED");
          if (
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            )
          )
            throw new Error("OVERFLOW");
          report.checks.push({
            viewport,
            pra: r.territoryId,
            indicator: id,
            period: payload.period,
            value: r.value,
            observed_value: r.observed_value ?? null,
            spatial_coverage: r.spatial_coverage ?? null,
            temporal_coverage: r.temporal_coverage ?? null,
            support_scope: r.support_scope ?? null,
            geometry_supports: expected,
            apiPanelMatch: true,
          });
          if (
            id === "gdd" &&
            (period === "day" || (viewport === "desktop" && code === "06249"))
          ) {
            await page.screenshot({
              path: `${output}/${viewport}-${period}-${code}.png`,
              fullPage: true,
            });
            if (period === "day" && code === "06249") {
              await page
                .getByRole("button", {
                  name: "Voir ce territoire",
                  exact: true,
                })
                .click();
              await page.locator(".national-map").scrollIntoViewIfNeeded();
              await page.waitForTimeout(300);
              await page.locator(".national-map").screenshot({
                path: `${output}/${viewport}-observed-area-map.png`,
              });
              if (viewport === "desktop") {
                const box = await page.locator(".national-map").boundingBox();
                let colored = false,
                  uncovered = false;
                for (let y = 1; y < 9 && !(colored && uncovered); y++)
                  for (let x = 1; x < 11 && !(colored && uncovered); x++) {
                    await page.mouse.move(
                      box.x + (box.width * x) / 11,
                      box.y + (box.height * y) / 9,
                    );
                    await page.waitForTimeout(25);
                    const text = await page
                      .locator(".national-hover")
                      .innerText();
                    if (text.includes("06249")) {
                      if (text.includes("Portion sans données"))
                        uncovered = true;
                      else if (text.includes(display)) colored = true;
                    }
                  }
                if (!colored || !uncovered)
                  throw new Error("COVERED_AND_GREY_HOVER_NOT_BOTH_FOUND");
                report.checks.push({
                  viewport,
                  observedAndUncoveredRealHover: true,
                });
              }
            }
          }
        }
      }
    const climateResponse = page.waitForResponse(
      (r) => {
        const url = new URL(r.url());
        return (
          url.pathname === "/api/unified" &&
          url.searchParams.get("indicator") === "gdd" &&
          url.searchParams.get("start") === "2026-10-31" &&
          r.ok()
        );
      },
      { timeout: 180000 },
    );
    await page.goto(
      origin +
        "/?pra=pra%3A06249&date=2026-10-31&start=2026-10-31&periode=periode&indicateur=gdd",
      { waitUntil: "domcontentloaded", timeout: 180000 },
    );
    const climate = (await (await climateResponse).json()).data.find(
      (r) => r.territoryId === "pra:06249",
    );
    if (climate.value !== null || climate.observed_value == null)
      throw new Error("CLIMATE_PORTION_NOT_QUALIFIED");
    await page
      .locator(".unified-panel")
      .filter({
        hasText: new Intl.NumberFormat("fr-FR", {
          maximumFractionDigits: 2,
        }).format(climate.observed_value),
      })
      .waitFor({ timeout: 60000 });
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector(".national-map")?.dataset.coveredSupportCount,
        ) === 67,
      undefined,
      { timeout: 60000 },
    );
    await page.screenshot({
      path: `${output}/${viewport}-climate-portion.png`,
      fullPage: true,
    });
    report.checks.push({
      viewport,
      space: "climat",
      pra: "pra:06249",
      value: climate.value,
      observed_value: climate.observed_value,
      apiPanelMatch: true,
      geometry_supports: 67,
    });
    await context.close();
  }
  if (report.errors.length) throw new Error(JSON.stringify(report.errors));
  await writeFile(output + "/acceptance.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ cases: report.checks.length, errors: report.errors }),
  );
} finally {
  await browser.close();
}
