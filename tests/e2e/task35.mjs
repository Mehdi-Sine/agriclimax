// Offline archive reading only. No model call and no credentials required.
import { protectTask30Preview } from "./task30-preview.mjs";
import { existsSync } from "node:fs";
import { chromium } from "./node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.TASK35_ORIGIN ?? "http://127.0.0.1:3002",
  out = process.env.TASK35_OUTPUT ?? "docs/codex/task35/evidence/browser";
const selected = new URL(origin);
if (
  !(
    ["localhost", "127.0.0.1"].includes(selected.hostname) &&
    selected.protocol === "http:"
  ) &&
  !(selected.protocol === "https:" && selected.hostname.endsWith(".vercel.app"))
)
  throw Error("Unsupported Preview origin");
const headers =
  selected.protocol === "https:" && process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? {
        "x-vercel-protection-bypass":
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      }
    : {};
const api = (path) =>
  fetch(origin + path, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
await mkdir(out, { recursive: true });
const report = {
  origin,
  checks: [],
  errors: [],
  measurements: [],
  openai_requests: 0,
};
const check = (name, ok) => {
  report.checks.push({ name, ok });
  if (!ok) throw Error(name);
};
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {}),
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport, locale: "fr-FR" });
    await protectTask30Preview(page.context(), origin);
    page.on("pageerror", (e) => report.errors.push(String(e)));
    page.on("request", (r) => {
      if (new URL(r.url()).hostname.endsWith("openai.com"))
        report.openai_requests++;
    });
    const start = performance.now();
    const response = await page.goto(origin + "/journal/preview", {
      waitUntil: "networkidle",
    });
    check(name + " HTTP 200", response.status() === 200);
    check(
      name + " simulation visible",
      (await page.locator("main").innerText()).includes("SIMULATION"),
    );
    check(
      name + " current replay",
      (await page.locator("h1").innerText()) ===
        "Le froid prévu en Auvergne-Rhône-Alpes appelle une lecture locale",
    );
    check(
      name + " no horizontal overflow",
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page
      .locator(".journal-pra-map")
      .first()
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await page.locator(".journal-pra-map canvas").waitFor({ state: "visible" });
    await page
      .getByRole("combobox", { name: "PRA du Journal" })
      .selectOption("pra:01195");
    check(
      name + " archived PRA selection",
      (await page
        .getByRole("complementary", { name: "PRA sélectionnée" })
        .count()) === 1,
    );
    await page.keyboard.press("Tab");
    check(
      name + " keyboard focus",
      await page.evaluate(() => document.activeElement !== document.body),
    );
    check(
      name + " real snapshot API",
      (await api("/api/journal-preview?date=2026-11-08")).ok,
    );
    const archive = await (
      await api("/api/journal-preview?date=2026-11-08")
    ).json();
    const map = await (
      await api(
        `/api/journal-preview/map?id=${archive.edition_id}&map=${archive.draft.illustration_ids[0]}`,
      )
    ).json();
    check(
      name + " frozen cycle and 713 PRA",
      map.rows.length === 713 && map.run === "2026-11-07T00:00:00+00:00",
    );
    check(
      name + " frozen period",
      map.period.join("/") === "2026-11-08/2026-11-14",
    );
    check(
      name + " no secret",
      !(await page.content()).includes("OPENAI_API_KEY") &&
        !(await page.content()).includes("SUPABASE_SECRET_KEY"),
    );
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    await page.locator("#edition-date").fill("2026-10-30");
    await page.getByRole("button", { name: "Consulter" }).click();
    await page.waitForLoadState("networkidle");
    check(
      name + " date navigation",
      (await page.locator("h1").innerText()).includes("Nouvelle-Aquitaine"),
    );
    check(
      name + " no substitute current map",
      (await page
        .getByRole("heading", { name: "Aucune carte compatible archivée" })
        .count()) === 1,
    );
    await page.screenshot({
      path: `${out}/${name}-historical.png`,
      fullPage: true,
    });
    await page.locator("#edition-date").fill("2000-01-01");
    await page.getByRole("button", { name: "Consulter" }).click();
    await page.waitForLoadState("networkidle");
    check(
      name + " absent date",
      (await page
        .getByRole("heading", { name: "Aucune édition archivée à cette date" })
        .count()) === 1,
    );
    await page.screenshot({ path: `${out}/${name}-empty.png`, fullPage: true });
    report.measurements.push({
      viewport: name,
      total_ms: Math.round(performance.now() - start),
    });
    await page.close();
  }
  check("no OpenAI calls on navigation", report.openai_requests === 0);
  check("no browser errors", report.errors.length === 0);
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
