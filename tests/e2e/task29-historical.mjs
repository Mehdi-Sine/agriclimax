// Read-only UI/API acceptance of qualified historical coastal data. No mocked data.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK29_ORIGIN ?? "http://127.0.0.1:3015",
  output = process.env.TASK29_OUTPUT ?? "docs/codex/task29/evidence/local";
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
    const periods = [
      ["day", "2026-10-31"],
      ["seven", "2026-10-25"],
      ["thirty", "2026-10-02"],
    ];
    for (const [period, start] of periods)
      for (const code of pras) {
        const ids =
          viewport === "desktop" && period === "day"
            ? code === "06249"
              ? [
                  "gdd",
                  "temperature_mean",
                  "rain",
                  "hot",
                  "frost",
                  "hot_sequence",
                  "frost_sequence",
                  "heavy_rain",
                  "dry",
                  "dry_sequence",
                  "thi",
                  "thi_days",
                  "thi_sequence",
                  "cattle_heat",
                ]
              : ["gdd", "temperature_mean", "rain", "hot", "frost"]
            : viewport === "desktop" && code === "06249"
              ? ["gdd", "rain", "hot", "frost"]
              : ["gdd"];
        for (const id of ids) {
          const query = new URLSearchParams({
            pra: "pra:" + code,
            production:
              id.startsWith("thi") || id === "cattle_heat" ? "cattle" : "wheat",
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
          const expected = id.startsWith("thi") ? 0 : 67;
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
          const notice = page.locator(".coastal-complement");
          if (r.complementary) {
            if (r.value !== null || r.observed_value !== null)
              throw new Error("MODEL_OVERWROTE_NATIVE");
            await notice.waitFor({ timeout: 60000 });
            if ((await notice.getAttribute("data-native-coverage")) !== "0")
              throw new Error("MODEL_NATIVE_COVERAGE");
            const modelLabel = new Intl.NumberFormat("fr-FR", {
              maximumFractionDigits: 2,
            }).format(r.complementary.value);
            if (!(await notice.innerText()).includes(modelLabel))
              throw new Error("MODEL_PANEL_API_MISMATCH");
          } else await notice.waitFor({ state: "detached", timeout: 60000 });
          if (
            (await page
              .locator(".national-map")
              .getAttribute("data-feature-count")) !== "713"
          )
            throw new Error("OFFICIAL_CONTOURS_LOST");

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
            complementary_value: r.complementary?.value ?? null,
            spatial_coverage: r.spatial_coverage ?? null,
            temporal_coverage: r.temporal_coverage ?? null,
            support_scope: r.support_scope ?? null,
            geometry_supports: expected,
            apiPanelMatch: true,
          });
          if (
            id === "gdd" &&
            (period === "day" || code === "06249" || code === "29102")
          ) {
            await page.waitForTimeout(350);
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
    for (const [climateId, code, start] of [
      ["gdd", "06249", "2026-10-25"],
      ["rain", "29102", "2026-10-02"],
      ["temperature_max", "06245", "2026-10-31"],
    ]) {
      const response = page.waitForResponse(
        (r) => {
          const url = new URL(r.url());
          return (
            url.pathname === "/api/unified" &&
            url.searchParams.get("indicator") === climateId &&
            url.searchParams.get("start") === start &&
            r.ok()
          );
        },
        { timeout: 180000 },
      );
      await page.goto(
        origin +
          "/?" +
          new URLSearchParams({
            pra: "pra:" + code,
            date: "2026-10-31",
            start,
            periode: "periode",
            indicateur: climateId,
          }),
        { waitUntil: "domcontentloaded", timeout: 180000 },
      );
      const row = (await (await response).json()).data.find(
        (r) => r.territoryId === "pra:" + code,
      );
      const value = row.value ?? row.observed_value ?? row.complementary?.value;
      const label = new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 2,
      }).format(value);
      await page
        .locator(".unified-panel")
        .filter({ hasText: label })
        .waitFor({ timeout: 60000 });
      await page
        .locator(
          '.national-map[data-ready="true"][data-covered-support-count="67"]',
        )
        .waitFor({ timeout: 90000 });
      if (row.complementary) {
        if (row.value !== null || row.observed_value != null)
          throw new Error("CLIMATE_MODEL_OVERWROTE_NATIVE");
        await page.locator(".coastal-complement").waitFor({ timeout: 60000 });
      } else if (row.value !== null || row.observed_value == null)
        throw new Error("CLIMATE_PARTIAL_SCOPE_INVALID");
      await page.locator(".national-map").scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      await page.screenshot({
        path:
          output +
          "/" +
          viewport +
          "-climate-" +
          climateId +
          "-" +
          code +
          ".png",
        fullPage: true,
      });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error("CLIMATE_OVERFLOW");
      report.checks.push({
        viewport,
        space: "climat",
        indicator: climateId,
        pra: "pra:" + code,
        start,
        value: row.value,
        observed_value: row.observed_value,
        complementary_value: row.complementary?.value ?? null,
        geometry_supports: 67,
        apiPanelMatch: true,
      });
    }
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
