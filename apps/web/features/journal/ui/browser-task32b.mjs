// Real archived editions and APIs only. Synthetic fixtures are confined to unit tests.
import { chromium } from "../../../../../tests/e2e/node_modules/playwright/index.mjs";
import { protectTask30Preview } from "../../../../../tests/e2e/task30-preview.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK32B_ORIGIN ?? "http://localhost:3002",
  output =
    process.env.TASK32B_OUTPUT ?? "docs/codex/task32/evidence/task32b/local";
const host = new URL(origin);
if (
  !["localhost", "127.0.0.1"].includes(host.hostname) &&
  !(host.protocol === "https:" && host.hostname.endsWith(".vercel.app"))
)
  throw Error("Unsupported origin");
await mkdir(output, { recursive: true });
const headers =
  host.protocol === "https:"
    ? {
        "x-vercel-protection-bypass":
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      }
    : {};
const report = {
  origin,
  tested_commit: process.env.TASK32B_COMMIT ?? null,
  transport:
    host.protocol === "https:"
      ? "Cloud Node proxy (decoded response sizes)"
      : "native browser",
  checks: [],
  errors: [],
  consoleErrors: [],
  measurements: [],
  api: [],
};
const check = (name, ok) => {
  report.checks.push({ name, ok });
  if (!ok) throw Error(name);
};
async function api(path) {
  const r = await fetch(origin + path, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw Error("API " + r.status);
  return { response: r, data: await r.json() };
}
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const { data: edition } = await api("/api/journal");
  const run = edition.source_cycles[0],
    theme = edition.main_story.phenomenon;
  const { data: watch } = await api(
    "/api/veille?run=" + encodeURIComponent(run),
  );
  for (const phenomenon of ["frost", "heat", "rain", "dry", "thi"]) {
    const query = new URLSearchParams({ run, phenomenon }),
      { data, response } = await api("/api/journal/map?" + query);
    check(phenomenon + " 713 PRA", data.rows.length === 713);
    check(
      phenomenon + " exact national metric values",
      data.rows.every((r) => {
        const m = watch.metrics.find(
          (m) => m.pra === r.id && m.phenomenon === phenomenon,
        );
        return r.value === (m.detected === null ? null : m.value);
      }),
    );
    const cached = await fetch(origin + "/api/journal/map?" + query, {
      headers: { ...headers, "if-none-match": response.headers.get("etag") },
      redirect: "error",
    });
    check(phenomenon + " ETag", cached.status === 304);
    report.api.push({
      phenomenon,
      run: data.run,
      source: data.source,
      rows: data.rows.length,
      bytes: Buffer.byteLength(JSON.stringify(data)),
    });
  }
  const first = (
    await api(
      "/api/journal/map?" + new URLSearchParams({ run, phenomenon: theme }),
    )
  ).data;
  const old = (
    await api(
      "/api/journal/map?" +
        new URLSearchParams({ run: "2026-11-06T00:00:00Z", phenomenon: theme }),
    )
  ).data;
  check(
    "archived map differs in real values and provenance",
    old.source !== first.source &&
      old.rows.some(
        (r) => r.value !== first.rows.find((v) => v.id === r.id)?.value,
      ),
  );
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
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => report.errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error")
        report.consoleErrors.push({ name, message: m.text() });
    });
    await page.addInitScript(() => {
      new PerformanceObserver((list) => {
        window.journalLcp = list.getEntries().at(-1)?.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const started = Date.now();
    await page.goto(origin + "/journal", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.locator("#headline").waitFor();
    const headlineVisibleMs = Date.now() - started;
    await page.locator(".journal-pra-map").scrollIntoViewIfNeeded();
    await page
      .locator('.national-map[data-ready="true"]')
      .waitFor({ timeout: 90000 });
    const mapReadyMs = Date.now() - started;
    check(
      name + " real 713-PRA canvas",
      (await page
        .locator(".national-map")
        .getAttribute("data-feature-count")) === "713" &&
        (await page.locator(".maplibregl-canvas").count()) === 1,
    );
    check(
      name + " correct theme",
      (await page
        .locator(".journal-pra-map")
        .getAttribute("data-phenomenon")) === theme,
    );
    check(
      name + " no horizontal overflow",
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      name + " three qualified key figures",
      (await page.locator(".key-facts article").count()) === 3,
    );
    check(
      name + " natural editorial dates",
      !/\b\d{4}-\d{2}-\d{2}\b/.test(
        await page
          .locator(
            ".hero-copy,.key-facts,.article-column,.secondary-grid,.production-grid,.region-grid,.journal-pra-map",
          )
          .allInnerTexts()
          .then((t) => t.join(" ")),
      ),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${name}-hero.png` });
    await page.screenshot({
      path: `${output}/${name}-full.png`,
      fullPage: true,
    });
    await page
      .locator(".front-page")
      .screenshot({ path: `${output}/${name}-front-page.png` });
    const available = first.rows.filter((r) => r.value !== null);
    const pra = (
      theme === "frost"
        ? available.reduce((a, b) => (a.value < b.value ? a : b))
        : available[0]
    ).id;
    await page.getByLabel("PRA du Journal", { exact: true }).selectOption(pra);
    await page
      .getByRole("complementary", { name: "PRA sélectionnée" })
      .waitFor();
    check(
      name + " official PRA selection",
      (await page.locator(".pra-selection h3").innerText()) ===
        first.rows.find((r) => r.id === pra).name,
    );
    const url = new URL(
      await page
        .getByText("Explorer les données de cette PRA", { exact: true })
        .getAttribute("href"),
      origin,
    );
    check(
      name + " explorer keeps exact cycle and PRA",
      url.searchParams.get("cycle") === run &&
        url.searchParams.get("pra") === pra &&
        url.searchParams.get("phenomene") === theme,
    );
    await page
      .locator(".journal-pra-map")
      .screenshot({ path: `${output}/${name}-pra-selected.png` });
    await page
      .getByRole("button", { name: "Activer zoom et déplacement" })
      .click();
    check(
      name + " explicit touch activation",
      (await page
        .getByRole("button", { name: "Désactiver le déplacement" })
        .getAttribute("aria-pressed")) === "true",
    );
    await page
      .getByRole("button", { name: "Désactiver le déplacement" })
      .click();
    check(
      name + " no raw 23MB geometry",
      !requests.some((r) => r.endsWith("/pra-national.geojson")),
    );
    check(
      name + " no duplicate data requests on selection",
      requests.filter((r) => r.includes("/api/journal/map?")).length === 1 &&
        requests.filter((r) => r.endsWith("/journal-pra-v1.geojson")).length ===
          1,
    );
    report.measurements.push({
      name,
      mapReadyMs,
      headlineVisibleMs,
      ...(await page.evaluate(() => ({
        lcpMs: window.journalLcp ?? null,
        paint: performance
          .getEntriesByType("paint")
          .map((p) => ({ name: p.name, ms: p.startTime })),
        jsBytes: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes(".js"))
          .reduce((n, r) => n + r.encodedBodySize, 0),
        resources: performance
          .getEntriesByType("resource")
          .filter((r) => /journal\/map|journal-pra|maplibre/.test(r.name))
          .map((r) => ({
            url: new URL(r.name).pathname,
            bytes: r.encodedBodySize,
            duration: r.duration,
          })),
      }))),
    });
    await page.goto(
      origin + "/journal?run=" + encodeURIComponent("2026-11-06T00:00:00Z"),
      { waitUntil: "networkidle", timeout: 90000 },
    );
    await page.locator(".journal-pra-map").scrollIntoViewIfNeeded();
    await page
      .locator('.national-map[data-ready="true"]')
      .waitFor({ timeout: 90000 });
    check(
      name + " archived map context",
      Date.parse(
        await page.locator(".journal-pra-map").getAttribute("data-cycle"),
      ) === Date.parse(old.run),
    );
    check(
      name + " old selection cleared",
      (await page
        .getByLabel("PRA du Journal", { exact: true })
        .inputValue()) === "",
    );
    await page
      .locator(".front-page")
      .screenshot({ path: `${output}/${name}-archived.png` });
    await page.keyboard.press("Tab");
    check(
      name + " keyboard focus",
      await page.evaluate(() => document.activeElement !== document.body),
    );
    await context.close();
  }
  const unavailable = await fetch(
    origin +
      "/api/journal/map?" +
      new URLSearchParams({ run: "2000-01-01T00:00:00Z", phenomenon: theme }),
    { headers, redirect: "error" },
  );
  check(
    "absent historical cycle returns no-store 503",
    unavailable.status === 503 &&
      unavailable.headers.get("cache-control") === "no-store",
  );
  const failureContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await protectTask30Preview(failureContext, origin);
  await failureContext.route("**/api/journal/map?**", (route) =>
    route.abort("failed"),
  );
  const failedPage = await failureContext.newPage();
  await failedPage.goto(origin + "/journal", {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await failedPage.locator(".journal-pra-map").scrollIntoViewIfNeeded();
  await failedPage
    .getByRole("alert")
    .filter({ hasText: "Carte de ce cycle indisponible" })
    .waitFor();
  check(
    "map network failure preserves real title and facts",
    (await failedPage.locator("#headline").count()) === 1 &&
      (await failedPage.locator(".key-facts article").count()) === 3,
  );
  await failedPage.screenshot({
    path: `${output}/map-unavailable.png`,
    fullPage: true,
  });
  await failureContext.close();
  check("no browser errors", report.errors.length === 0);
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
