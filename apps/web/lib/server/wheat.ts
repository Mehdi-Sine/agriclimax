import {forecastSupport, enrichHistoricalInputs} from "./climate-quality";
import {coverageWheatRules, COVERAGE_WHEAT_VERSION, coverageQualification} from "../../features/wheat/coverage";
import type {QualifiedDay} from "../../features/climate-quality/calculate";
import "server-only";
import {climateHistoryWindow} from "./climate-history";
import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";
import geography from "../../data/operational/pra-watch-places.json";
import type { Rule } from "../../features/agroclimatic/catalogue";
import type { WheatDay } from "../../features/wheat/qualified";
import {
  WHEAT_VERSION,
  wheatRules,
  wheatPeriod,
  qualification,
} from "../../features/wheat/qualified";
import {
  summarizeWheat,
  type WheatSummary,
} from "../../features/wheat/national";
import {
  nationalWeatherDocument,
  type NationalWeatherDocument,
  type ArchivedDaily,
} from "./weather-archives";
import type { WeatherRow } from "../../features/operational/model";
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function forecastWheatInputs(
  document: NationalWeatherDocument,
  rule: Rule,
  dates: string[],
): Record<string, WheatDay[]> {
  const groups = new Map<string, WeatherRow[]>();
  for (const index of document.selected_indices) {
    const r = document.rows[index];
    if (!dates.includes(r.valid_date) || !rule.variables.includes(r.variable))
      continue;
    const k = r.pra_id + "/" + r.valid_date;
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  const inputs: Record<string, WheatDay[]> = {};
  for (const rows of groups.values()) {
    const first = rows[0],
      expectedUnit = first.variable === "precipitation" ? "mm" : "degC";
    const day: WheatDay = {
      pra: first.pra_id,
      date: first.valid_date,
      values: Object.fromEntries(rows.map((r) => [r.variable, r.value])),
      compatible:
        rows.length === rule.variables.length &&
        new Set(rows.map((r) => r.variable)).size === rule.variables.length &&
        rows.every(
          (r) =>
            r.unit === expectedUnit &&
            r.nature === "forecast" &&
            Date.parse(r.valid_from) ===
              Date.parse(r.valid_date + "T00:00:00Z") &&
            Date.parse(r.valid_to) - Date.parse(r.valid_from) === 86400000,
        ),
      complete: rows.every((r) => r.status === "available"),
      source: first.source_id,
      run: first.model_run_at,
      nature: first.nature,
      freshness: first.data_freshness,
      provenance: rows.map(
        (r) => `${r.source_id}/${r.model_run_at}/${r.provenance_sha256}`,
      ),
      quality_flags: rows.flatMap((r) => r.quality_flags),
      climate_support: forecastSupport(rows),
      support_key: rows
        .map(
          (r) =>
            `${r.model}/${r.grid_version}/${r.weights_sha256}/${r.rule_version}/${r.provenance.reference_version}`,
        )
        .join("|"),
      spatial_coverage: Math.min(...rows.map((r) => r.spatial_coverage)),
      temporal_coverage: Math.min(...rows.map((r) => r.temporal_coverage)),
    };
    (inputs[day.pra] ??= []).push(day);
  }
  return inputs;
}
const fields = [
  "temperature",
  "temperature_min",
  "temperature_max",
  "precipitation",
] as const;
export function historicalWheatInputs(
  rows: ArchivedDaily[],
  rule: Rule,
): Record<string, WheatDay[]> {
  const field = rule.variables[0] as (typeof fields)[number],
    index = fields.indexOf(field),
    inputs: Record<string, WheatDay[]> = {};
  for (const r of rows) {
    const i = r.identity;
    const support = [
      i.method,
      i.reference_geometry_sha256,
      i.weights_sha256,
      i.dataset,
    ];
    const day: WheatDay = {
      pra: r.pra_id,
      date: r.valid_date,
      values: {
        temperature: r.temperature,
        temperature_min: r.temperature_min,
        temperature_max: r.temperature_max,
        precipitation: r.precipitation,
      },
      compatible: true,
      complete: r.status === "available",
      source: "era5-land",
      run: null,
      nature: "reanalysis",
      freshness: `source ${r.valid_date}; calculated ${r.computed_at}`,
      provenance: [r.batch_key],
      quality_flags: [
        ...r.quality_flags,
        "coastal_representativeness_not_guaranteed",
      ],
      climate_support: support.every(Boolean) ? {id: hash(support), fraction: r.coverage[index], temporal_complete: r.expected_cells > 0 && r.valid_counts[index] === r.expected_cells, mask: "native_valid_cells", method: String(i.method)} : undefined,
      support_key: support.every(Boolean) ? hash(support) : "",
      spatial_coverage: r.coverage[index],
      temporal_coverage:
        r.expected_cells > 0 && r.valid_counts[index] === r.expected_cells
          ? 1
          : 0,
    };
    (inputs[day.pra] ??= []).push(day);
  }
  return inputs;
}
// Calculate all rules from one set of archive reads, not ten national service calls.
export function computeWheatBatch(
  period: [string, string],
  source: {
    version: string;
    nature: WheatSummary["nature"];
    run: string | null;
  },
  inputs: (rule: Rule) => Record<string, WheatDay[]>,
  rules: Rule[] = wheatRules,
) {
  const inputCache = new Map<string, Record<string, WheatDay[]>>();
  const indicators: WheatSummary["indicators"] = [];
  const results: ReturnType<typeof summarizeWheat>["results"] = {};
  // Each variable has its own spatial/provenance identity. Keep calculations separate while sharing I/O.
  for (const rule of rules) {
    const variableKey = rule.variables.join();
    let one = inputCache.get(variableKey);
    if (!one) {
      one = inputs(rule);
      inputCache.set(variableKey, one);
    }
    const all = summarizeWheat(geography.places, one, period, source, [rule]);
    indicators.push(all.summary.indicators.find((i) => i.id === rule.id)!);
    results[rule.id] = all.results[rule.id];
  }
  const core = {
    version: rules[0]?.version ?? WHEAT_VERSION,
    source_version: source.version,
    nature: source.nature,
    run: source.run,
    period,
    qualification: rules[0]?.version === COVERAGE_WHEAT_VERSION ? coverageQualification : qualification,
    indicators,
  };
  return { summary: { ...core, identity: hash(core) }, results };
}
const RULE_IDENTITY = hash([coverageWheatRules, coverageQualification]);
const cache = new Map<string, Promise<WheatSummary[]>>();
export async function wheatForecast(
  document: NationalWeatherDocument,
): Promise<WheatSummary[]> {
  const key = `${document.archive_sha256}/${COVERAGE_WHEAT_VERSION}/${RULE_IDENTITY}`,
    hit = cache.get(key);
  if (hit) return hit;
  const task = Promise.resolve().then(() => {
    const start = new Date(Date.parse(document.run) + 86400000)
        .toISOString()
        .slice(0, 10),
      end = new Date(Date.parse(document.run) + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
    return (
      [
        [start, start],
        [start, end],
      ] as [string, string][]
    ).map(
      (period) =>
        computeWheatBatch(
          period,
          {
            version: document.archive_sha256,
            nature: "forecast",
            run: document.run,
          },
          (rule) => forecastWheatInputs(document, rule, wheatPeriod(...period)),
          coverageWheatRules,
        ).summary,
    );
  });
  if (cache.size >= 3) cache.delete(cache.keys().next().value!);
  cache.set(key, task);
  void task.catch(() => {
    if (cache.get(key) === task) cache.delete(key);
  });
  return task;
}
const historyCache = new Map<string, Promise<ReturnType<typeof computeWheatBatch>>>();
export async function wheatHistory(period: [string, string]) {
  const dates = wheatPeriod(...period);
  const history = await climateHistoryWindow(dates);
  const identity = hash([period, history.version, RULE_IDENTITY]);
  const hit = historyCache.get(identity);
  if (hit) return hit;
  const task = (async () => {
  const rows = history.rows;
  const enriched = new Map<string, Record<string, QualifiedDay[]>>();
  for (const rule of coverageWheatRules) {
    const key = rule.variables.join();
    if (!enriched.has(key)) enriched.set(key, await enrichHistoricalInputs(historicalWheatInputs(rows, rule), rule));
  }
  return computeWheatBatch(
    period,
    {
      version: history.version,
      nature: "reanalysis",
      run: null,
    },
    (rule) => enriched.get(rule.variables.join()) as Record<string, WheatDay[]>,
    coverageWheatRules,
  );
  })();
  // One heavy historical result per process; the workflow exports compact per-cycle products.
  historyCache.clear();
  historyCache.set(identity, task);
  void task.catch(() => {if (historyCache.get(identity) === task) historyCache.delete(identity);});
  return task;
}
export async function latestWheatForecast(run?: string) {
  const d = await nationalWeatherDocument(run);
  if (!d) throw new Error("NO_VERIFIED_WHEAT_CYCLE");
  return unstable_cache(
    () => wheatForecast(d),
    ["wheat-cycle", d.archive_sha256, COVERAGE_WHEAT_VERSION, RULE_IDENTITY],
    { revalidate: false },
  )();
}
