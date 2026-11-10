import { it, expect, vi } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
vi.mock("server-only", () => ({}));
import geography from "../../data/operational/pra-watch-places.json";
import { computeBatch, type ProductionDay } from "./engine";
import { RECIPES, PRODUCTIONS, VERSION } from "./registry";
import { createContributors } from "./editorial";
import { createRegistry } from "../journal/registry";
import type { WatchSummary } from "../national-watch/model";

type Inputs = Record<string, Record<string, ProductionDay[]>>;
it("replays frozen operational archives across 713 PRA and independently validates every portfolio", () => {
  const began = performance.now(),
    rss = process.memoryUsage().rss;
  const raw = readFileSync(
    "../../docs/codex/CORE-01/evidence/frozen-inputs.json.gz",
  );
  const frozen = JSON.parse(gunzipSync(raw).toString()) as { inputs: Inputs };
  const cases: {
    input: string;
    pra: string;
    period: [string, string];
    recipe: string;
    value: number | null;
    observed: number | null;
    state: string | undefined;
  }[] = [];
  const matrix: unknown[] = [],
    samples: unknown[] = [],
    metrics: unknown[] = [];
  const selected = geography.places
    .filter(
      (p) =>
        p.id === "pra:29102" ||
        p.name.includes("BEAUCE") ||
        p.name.includes("MONTAGNE") ||
        p.region === "Corse" ||
        p.name.includes("LITTORAL"),
    )
    .slice(0, 12)
    .map((p) => p.id);
  let contributions = 0;
  for (const [nature, end, windows] of [
    ["reanalysis", "2026-11-01", [1, 7, 14, 30]],
    ["forecast", "2026-11-14", [1, 7]],
  ] as const)
    for (const n of windows) {
      const start = new Date(Date.parse(end) - (n - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      const period: [string, string] = [start, end];
      // Forecast J+1 uses the known archived J+1, not an invented later cycle.
      if (nature === "forecast" && n === 1)
        period[0] = period[1] = "2026-11-08";
      const inputKey = (variables: readonly string[]) => {
        const variable = variables.includes("humidity")
          ? "temperature"
          : variables[0];
        const requested = `${nature}/${period[0]}/${period[1]}/${variable}`;
        return frozen.inputs[requested]
          ? requested
          : `${nature}/${nature === "reanalysis" ? "2026-10-03" : "2026-11-08"}/${end}/${variable}`;
      };
      const t = performance.now();
      const b = computeBatch(
        geography.places.map((p) => p.id),
        period,
        (pra, variables) =>
          (frozen.inputs[inputKey(variables)]?.[pra] ?? []).filter(
            (d) => d.date >= period[0] && d.date <= period[1],
          ),
      );
      expect(b.metrics.pra_count).toBe(713);
      metrics.push({
        nature,
        period,
        ...b.metrics,
        milliseconds: performance.now() - t,
      });
      const seen = new Set<string>();
      for (const m of b.measurements) {
        const recipe = RECIPES.find((r) => r.id === m.indicator)!;
        const key = `${m.result.territoryId}/${m.indicator}`;
        if (!seen.has(key))
          cases.push({
            input: inputKey(recipe.kernel.variables),
            pra: m.result.territoryId,
            period,
            recipe: m.indicator,
            value: m.result.value,
            observed: m.result.observed_value ?? null,
            state: m.result.quality?.state,
          });
        seen.add(key);
        if (
          selected.includes(m.result.territoryId) &&
          ["gdd_base6", "frost", "rain", "thi"].includes(m.indicator)
        )
          samples.push(m);
      }
      for (const p of PRODUCTIONS)
        for (const id of p.indicators) {
          const results = b.measurements
            .filter((m) => m.production === p.id && m.indicator === id)
            .map((m) => m.result);
          const counts: Record<string, number> = {},
            reasons: Record<string, number> = {};
          for (const r of results) {
            const state = r.quality?.state ?? "unknown";
            counts[state] = (counts[state] ?? 0) + 1;
            if (r.reason) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
          }
          matrix.push({
            production: p.id,
            indicator: id,
            nature,
            period,
            total: results.length,
            states: counts,
            reasons,
            scientific_status: "exploratory",
          });
        }
      const c = createRegistry(
        createContributors(b.measurements, geography.places),
      ).read({} as WatchSummary);
      expect(c).toHaveLength(6);
      contributions += c.flatMap((p) => p.indicators).length;
    }
  const oracle = spawnSync(
    "python",
    ["../../docs/codex/AGRO-02/reference.py"],
    {
      input: JSON.stringify({
        inputs: frozen.inputs,
        cases,
        rules: Object.fromEntries(RECIPES.map((r) => [r.id, r.kernel])),
      }),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  expect(oracle.status, oracle.stdout + oracle.stderr).toBe(0);
  const report = {
    version: VERSION,
    executed_at: new Date().toISOString(),
    source:
      "CORE-01 frozen operational archive inputs; replay, not a live availability assertion",
    sha256: createHash("sha256").update(raw).digest("hex"),
    independent: JSON.parse(oracle.stdout),
    metrics,
    editorial_indicators: contributions,
    elapsed_ms: performance.now() - began,
    rss_delta_bytes: process.memoryUsage().rss - rss,
  };
  if (process.env.AGRO02_EVIDENCE === "1") {
    const out = "../../docs/codex/AGRO-02/evidence";
    mkdirSync(out, { recursive: true });
    for (const [name, value] of Object.entries({ report, matrix }))
      writeFileSync(
        `${out}/${name}.json`,
        JSON.stringify(value, null, 2) + "\n",
      );
    writeFileSync(
      `${out}/samples.json.gz`,
      gzipSync(JSON.stringify(samples, null, 2) + "\n"),
    );
  }
  expect(report.independent.mismatches).toBe(0);
}, 180000);
