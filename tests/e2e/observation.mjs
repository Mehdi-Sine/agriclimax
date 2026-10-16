import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const webRequire = createRequire(path.resolve("apps/web/package.json"));
const lintRequire = createRequire(webRequire.resolve("eslint-config-next"));
const a11yRequire = createRequire(
  lintRequire.resolve("eslint-plugin-jsx-a11y"),
);
const axePath = a11yRequire.resolve("axe-core/axe.min.js");
const baseURL = process.env.OBSERVATION_BASE_URL || "http://127.0.0.1:3000";
const dir = path.resolve(
  process.env.OBSERVATION_ARTIFACTS || "docs/codex/verification/task06",
);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_EXECUTABLE || (existsSync("/usr/lib/chromium/chromium") ? "/usr/lib/chromium/chromium" : undefined),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const reports = [];
const demoURL = `${baseURL}/?mode=demo&production=wheat_soft&indicator=tmax_days_above&date=2026-07-01`;
const fixture = JSON.parse(
  await readFile("fixtures/demo-risk.geojson.json", "utf8"),
);
const result = JSON.parse(
  await readFile("fixtures/contracts/risk-result.json", "utf8"),
);
const liveData = {
  type: "FeatureCollection",
  limit: 1000,
  truncated: false,
  features: fixture.features.map((f) => ({
    ...f,
    properties: {
      ...f.properties,
      demo: undefined,
      freshness: "stale",
      result: { ...result, quality: { ...result.quality, freshness: "stale" } },
    },
  })),
};
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["tablet", 1024, 768],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [],
      external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin !== new URL(baseURL).origin) {
        external.push(new URL(route.request().url()).hostname);
        await route.abort();
      } else await route.continue();
    });
    await page.goto(demoURL, { waitUntil: "networkidle" });
    await page.locator(".maplibregl-canvas").waitFor();
    await page.getByRole("button", { name: "demo-001", exact: true }).waitFor();
    await page.waitForTimeout(800);
    assert.equal(
      await page.locator(".observation-map-status").count(),
      0,
      "Map must render successfully",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.waitForFunction(() => new URLSearchParams(location.search).has("bbox"));
    const bounds = new URL(page.url()).searchParams.get("bbox").split(",").map(Number);
    const canvas = page.locator(".maplibregl-canvas");
    const box = await canvas.boundingBox();
    const mercator = latitude => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
    await canvas.click({ position: {
      x: (1.5 - bounds[0]) / (bounds[2] - bounds[0]) * box.width,
      y: (mercator(bounds[3]) - mercator(48.5)) / (mercator(bounds[3]) - mercator(bounds[1])) * box.height,
    } });
    await page.waitForURL(/territory=demo-001/);
    await page.goBack();
    await page.waitForFunction(() => !new URLSearchParams(location.search).has("territory"));
    await page.getByRole("button", { name: "demo-001", exact: true }).click();
    await page.waitForURL(/territory=demo-001/);
    assert.ok(
      await page
        .locator(".demo-banner")
        .innerText()
        .then((t) => t.includes("Données fictives")),
    );
    if (name === "mobile") {
      assert.ok(await page.locator(".observation-bottom-sheet").isVisible());
      await page
        .getByRole("button", { name: "Développer", exact: true })
        .click();
      assert.ok(
        (await page.locator(".observation-bottom-sheet").innerText()).includes(
          "demo-fiction",
        ),
      );
      await page.getByRole("button", { name: "Réduire", exact: true }).click();
      await page.getByRole("button", { name: "Filtres", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
        assert.ok(
          await page
            .getByRole("dialog")
            .evaluate((el) => el.contains(document.activeElement)),
        );
      }
      await page.keyboard.press("Escape");
      assert.ok(
        await page
          .getByRole("button", { name: "Filtres", exact: true })
          .evaluate((el) => el === document.activeElement),
      );
    } else {
      assert.ok(
        (
          await page.locator(".observation-desktop-detail").innerText()
        ).includes("demo-fiction"),
      );
      await page
        .getByRole("button", { name: "Replier le détail", exact: true })
        .click();
      assert.equal(
        await page.locator(".observation-desktop-detail").isVisible(),
        false,
      );
      await page
        .getByRole("button", { name: "Afficher le détail", exact: true })
        .click();
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(dir, `${name}-${width}x${height}.png`),
    });
    // Deep link reload reproduces selection and camera bounds.
    const link = page.url();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "demo-001", exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("territory"), "demo-001");
    assert.equal(
      new URL(page.url()).searchParams.get("bbox"),
      new URL(link).searchParams.get("bbox"),
    );
    // Keyboard camera navigation serializes URL; restoring a deep link restores the context.
    await page.locator(".maplibregl-canvas").focus();
    const before = page.url();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      (previous) => location.href !== previous,
      before,
    );
    assert.ok(new URL(page.url()).searchParams.has("bbox"));
    await page.goto(link, { waitUntil: "networkidle" });
    // Layers do not mutate underlying accessible data.
    await page.getByRole("button", { name: "Couches", exact: true }).click();
    await page
      .getByRole("checkbox", {
        name: "Classes de risque fournies par la source",
      })
      .uncheck();
    await page.keyboard.press("Escape");
    assert.ok(
      await page
        .getByRole("button", { name: "demo-001", exact: true })
        .isVisible(),
    );
    for (const theme of ["light", "dark"]) {
      if (
        ((await page.locator("html").getAttribute("data-theme")) || "light") !==
        theme
      )
        await page
          .getByRole("button", { name: "Activer le thème sombre" })
          .click();
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () =>
        (
          await window.axe.run(document.querySelector(".observation-space"), {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          })
        ).violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          count: v.nodes.length,
        })),
      );
      reports.push({ name, width, height, theme, violations });
    }
    // No-data explicitly differs from risk.
    await page.goto(`${baseURL}/?mode=demo&production=dairy_cattle&date=2026-07-01`, {
      waitUntil: "networkidle",
    });
    await page.locator(".observation-data-status .state-missing").waitFor();
    assert.equal(await page.locator(".observation-table tbody tr").count(), 0);
    // Live integration uses deterministic API responses, with no invented UI values.
    let releaseLive;
    const liveGate = new Promise(resolve => { releaseLive = resolve; });
    await page.route("**/api/risks/map?*", async (route) => {
      await liveGate;
      await route.fulfill({ json: liveData });
    });
    const liveURL = `${baseURL}/?mode=live&production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&rule=test-rule&version=1&territory=demo-001`;
    await page.goto(liveURL, { waitUntil: "domcontentloaded" });
    await page.locator(".observation-data-status .state-loading").waitFor();
    releaseLive();
    await page.getByRole("button", { name: "demo-001", exact: true }).waitFor();
    assert.ok(
      (await page.locator(".demo-banner").innerText()).includes("Données live"),
    );
    assert.ok(
      await page.locator(".observation-space > .state-stale").waitFor().then(() => true),
    );
    assert.equal(
      await page.locator(".observation-space [data-demo=true]").count(),
      0,
    );
    await page.unroute("**/api/risks/map?*");
    await page.route("**/api/risks/map?*", (route) =>
      route.fulfill({
        json: { type: "FeatureCollection", truncated: false, features: [] },
      }),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".observation-data-status .state-missing").waitFor();
    await page.unroute("**/api/risks/map?*");
    await page.route("**/api/risks/map?*", (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: "NOT_CONFIGURED" } },
      }),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page
      .locator(".observation-data-status .state-source-error")
      .waitFor();
    assert.equal(await page.locator(".observation-table tbody tr").count(), 0);
    await page
      .getByRole("button", { name: "Utiliser la démo", exact: true })
      .click();
    await page.getByRole("button", { name: "demo-001", exact: true }).waitFor();
    assert.ok(
      (await page.locator(".demo-banner").innerText()).includes(
        "Données fictives",
      ),
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await context.close();
  }
} finally {
  await writeFile(
    path.join(dir, "interaction-report.json"),
    JSON.stringify(reports, null, 2),
  );
  await browser.close();
}
assert.ok(
  reports.every((r) => r.violations.length === 0),
  "Accessibility failures: see interaction-report.json",
);
console.log(
  "Observation interactions, responsive screenshots, API states and accessibility passed.",
);
