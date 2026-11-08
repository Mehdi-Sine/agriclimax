import {calculateQualified, coverageRule, UNIFIED_AGRO_VERSION, type QualifiedDay} from "../../features/climate-quality/calculate";
import {forecastSupport, applyObservedSupport} from "./climate-quality";
import "server-only";
import { coastalComplement } from "./coastal-complement";
import { createHash } from "node:crypto";
import identities from "../../data/operational/pra-identities.json";
import { RULES, type Rule } from "../../features/agroclimatic/catalogue";
import {
  calculate,
  type AgroResult,
} from "../../features/agroclimatic/calculate";
import { calendarDays } from "../../features/national/daily-availability";
import { NATIONAL } from "../../features/national/model";
import { nationalWeatherDocument, archivedEra5Day } from "./weather-archives";
import { nationalData } from "./national";
import { nationalDays } from "./national-availability";
import { observedSupportDay } from "./spatial-restitution";
import {
  calculateObserved,
  observedRule,
  supportPolicy,
  STRICT_RULE_VERSION,
  OBSERVED_RULE_VERSION,
  NATIVE_RULE_VERSION,
  type SupportedDay,
} from "../../features/agroclimatic/observed-support";
import { ApiError } from "./query";
import type { ClimateContextRow } from "../../features/national/model";
import type { WeatherRow } from "../../features/operational/model";
export interface AgroPayload {
  contract_version: string;
  rule: Rule;
  parameters: { threshold: number | null };
  period: { start: string; end: string; timezone: string };
  temporal: string;
  source_version: string;
  run: string | null;
  calculated_at: string;
  calculation_ms: number;
  data: AgroResult[];
}
const cache = new Map<
  string,
  { expires: number; value: Promise<AgroPayload> }
>();
const nativeDayCache = new Map<
  string,
  { expires: number; value: Promise<ClimateContextRow[]> }
>();
function retainedDay(date: string, variable: string) {
  const key = `${NATIONAL.dataset}/${date}/${variable}`,
    hit = nativeDayCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = nationalData(
    new URLSearchParams({
      action: "context-day",
      date,
      variable,
      storage: "cold",
    }),
  ).then((r) => r.data as ClimateContextRow[]);
  if (nativeDayCache.size >= 120)
    nativeDayCache.delete(nativeDayCache.keys().next().value!);
  nativeDayCache.set(key, { expires: Date.now() + 60000, value });
  void value.catch(() => {
    if (nativeDayCache.get(key)?.value === value) nativeDayCache.delete(key);
  });
  return value;
}
export async function agroclimaticData(params: URLSearchParams) {
  const allowed = [
    "indicator",
    "threshold",
    "temporal",
    "start",
    "end",
    "run",
    "pra",
    "rule_version",
  ];
  const pra = params.get("pra");
  if (pra && !identities.ids.includes(pra))
    throw new ApiError("INVALID_QUERY", 400);
  const baseRule = RULES.find((r) => r.id === params.get("indicator"));
  const requestedVersion = params.get("rule_version");
  const unified = !requestedVersion || requestedVersion === UNIFIED_AGRO_VERSION;
  if (
    requestedVersion &&
    ![STRICT_RULE_VERSION, OBSERVED_RULE_VERSION, NATIVE_RULE_VERSION, UNIFIED_AGRO_VERSION].includes(
      requestedVersion,
    )
  )
    throw new ApiError("INVALID_QUERY", 400);
  const useSupport =
    (params.get("temporal") ?? "history") === "history" &&
    requestedVersion !== STRICT_RULE_VERSION &&
    !!baseRule &&
    supportPolicy(baseRule) !== null &&
    (requestedVersion !== OBSERVED_RULE_VERSION ||
      [
        "temperature_mean",
        "gdd",
        "rain",
        "dry",
        "dry_sequence",
        "heavy_rain",
      ].includes(baseRule.id));
  const rule = unified && baseRule ? coverageRule(baseRule) : useSupport
    ? observedRule(baseRule!, requestedVersion ?? NATIVE_RULE_VERSION)
    : baseRule;
  if (requestedVersion && rule && rule.version !== requestedVersion)
    throw new ApiError("INVALID_QUERY", 400);
  const temporal = params.get("temporal") ?? "history",
    start = params.get("start") ?? "",
    end = params.get("end") ?? "";
  const dates = calendarDays(start, end),
    threshold = params.has("threshold")
      ? Number(params.get("threshold"))
      : (rule?.threshold ?? null);
  if (
    !rule ||
    !["history", "recent", "forecast"].includes(temporal) ||
    !dates.length ||
    dates.length > 30 ||
    [...params.keys()].some(
      (k) => !allowed.includes(k) || params.getAll(k).length !== 1,
    ) ||
    (threshold !== null &&
      (!Number.isFinite(threshold) || threshold < -30 || threshold > 100)) ||
    (rule.variables.includes("precipitation") &&
      threshold !== null &&
      threshold < 0)
  )
    throw new ApiError("INVALID_QUERY", 400);
  const availableDays =
    temporal === "history" ? await nationalDays(fetch, [start, end]) : [];
  if (
    temporal === "history" &&
    (!availableDays.includes(start) || !availableDays.includes(end))
  )
    throw new ApiError("INVALID_QUERY", 400);
  const requestedRun = params.get("run");
  if (
    requestedRun &&
    !/^\d{4}-\d{2}-\d{2}(T(?:00|06|12|18):00:00(?:Z|\+00:00))?$/.test(
      requestedRun,
    )
  )
    throw new ApiError("INVALID_QUERY", 400);
  const document =
    temporal === "history"
      ? null
      : await nationalWeatherDocument(requestedRun ?? undefined);
  if (temporal !== "history" && !document)
    throw new ApiError("UPSTREAM_UNAVAILABLE", 503);
  if (document) {
    const root = Date.parse(document.run.slice(0, 10));
    if (
      dates.some((d) => {
        const lead = (Date.parse(d) - root) / 86400000;
        return temporal === "forecast"
          ? lead < 1 || lead > 7
          : lead < -1 || lead > 0;
      })
    )
      throw new ApiError("INVALID_QUERY", 400);
  }
  // Weather archives already verify checksums. Cache keys include the complete immutable input identity.
  const version = document
    ? createHash("sha256")
        .update(
          JSON.stringify([
            document.run,
            document.acquired_at,
            document.selected_indices,
            document.rows.map((r) => r.provenance_sha256),
          ]),
        )
        .digest("hex")
    : NATIONAL.dataset;
  const key = JSON.stringify([
    rule.version,
    rule.id,
    threshold,
    temporal,
    start,
    end,
    version,
  ]);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return project(await hit.value);
  const value = compute();
  async function compute() {
    const grouped = new Map<string, (SupportedDay & QualifiedDay)[]>();
    if (document) {
      const selected = document.selected_indices
        .map((i) => document.rows[i])
        .filter((r) => dates.includes(r.valid_date));
      const daily = new Map<string, WeatherRow[]>();
      for (const row of selected) {
        const key = `${row.pra_id}/${row.valid_date}`,
          list = daily.get(key) ?? [];
        list.push(row);
        daily.set(key, list);
      }
      for (const rows of daily.values()) {
        const needed = rows.filter((r) => rule!.variables.includes(r.variable));
        const first = needed[0] ?? rows[0];
        const row: SupportedDay & QualifiedDay = {
          pra: first.pra_id,
          date: first.valid_date,
          values: Object.fromEntries(needed.map((r) => [r.variable, r.value])),
          compatible:
            new Set(
              needed.map(
                (r) =>
                  `${r.source_id}/${r.model_run_at}/${r.valid_from}/${r.valid_to}`,
              ),
            ).size === 1,
          climate_support: forecastSupport(needed),
          complete:
            needed.length === rule!.variables.length &&
            needed.every(
              (r) =>
                (r.status === "available" || (unified && r.status === "partial" && r.value !== null)) &&
                (unified ? r.spatial_coverage > 0 : r.spatial_coverage >= 0.9999) &&
                r.temporal_coverage === 1,
            ),
          source: first.source_id,
          run: first.model_run_at,
          nature:
            temporal === "recent"
              ? "forecast_based_recent_estimate"
              : "forecast",
          freshness: first.data_freshness,
          provenance: needed.map(
            (r) => `${r.source_id}/${r.model_run_at}/${r.provenance_sha256}`,
          ),
          quality_flags: needed.flatMap((r) => r.quality_flags),
        };
        const list = grouped.get(row.pra) ?? [];
        list.push(row);
        grouped.set(row.pra, list);
      }
    } else {
      // Shared national day reads; never one request per PRA. Humidity is absent from this historical contract.
      for (let i = 0; i < dates.length; i += 4)
        await Promise.all(
          dates
            .slice(i, i + 4)
            .filter((date) => availableDays.includes(date))
            .map(async (date) => {
              const support = useSupport
                ? await observedSupportDay(
                    date,
                    rule!.variables[0],
                    requestedVersion === OBSERVED_RULE_VERSION,
                  )
                : null;
              const observed = new Map(support?.rows.map((r) => [r.pra_id, r]));
              function qualify(
                row: SupportedDay & QualifiedDay,
                sourceCoverage: number | undefined,
              ) {
                if (unified && support) return applyObservedSupport(row, sourceCoverage, support, rule!.variables[0]);
                const p = observed.get(row.pra);
                if (
                  row.complete ||
                  !support?.verified ||
                  !p ||
                  !p.support_id ||
                  !support.geometries[p.support_id] ||
                  p.observed_value === null ||
                  p.temporal_coverage !== 1 ||
                  p.coverage <= 0 ||
                  sourceCoverage === undefined ||
                  Math.abs(sourceCoverage - p.coverage) > 1e-5
                )
                  return row;
                return {
                  ...row,
                  complete: true,
                  values: {
                    ...row.values,
                    [rule!.variables[0]]: p.observed_value,
                  },
                  support: {
                    id: p.support_id,
                    identity: support.identity,
                    coverage: p.coverage,
                    temporal_coverage: p.temporal_coverage,
                  },
                  provenance: [
                    ...row.provenance,
                    `${support.identity}/${p.support_id}/${date}/${support.data_sha256}`,
                  ],
                  quality_flags: [...row.quality_flags, ...p.quality_flags],
                };
              }
              const archived = await archivedEra5Day(date);
              if (archived) {
                for (const saved of archived) {
                  const fields = [
                    "temperature",
                    "temperature_min",
                    "temperature_max",
                    "precipitation",
                  ] as const;
                  const variables = rule!.variables.filter(
                    (v) => v !== "humidity",
                  );
                  const row: SupportedDay & QualifiedDay = {
                    pra: saved.pra_id,
                    date,
                    climate_support: saved.identity && [saved.identity.method, saved.identity.reference_geometry_sha256, saved.identity.weights_sha256, saved.identity.dataset].every(Boolean) ? {id: JSON.stringify([saved.identity.method, saved.identity.reference_geometry_sha256, saved.identity.weights_sha256, saved.identity.dataset]), fraction: saved.coverage[fields.indexOf(variables[0])], temporal_complete: saved.expected_cells > 0 && variables.every(v => saved.valid_counts[fields.indexOf(v)] === saved.expected_cells), mask: "native_valid_cells", method: String(saved.identity.method ?? "")} : undefined,
                    source_coverage:
                      saved.coverage[fields.indexOf(variables[0])],
                    values: Object.fromEntries(
                      variables.map((v) => [v, saved[v]]),
                    ),
                    compatible: true,
                    complete:
                      !rule!.variables.includes("humidity") &&
                      saved.status === "available" &&
                      variables.every(
                        (v) => saved.coverage[fields.indexOf(v)] >= 0.9999,
                      ),
                    source: "era5-land",
                    run: null,
                    nature: "reanalysis",
                    freshness: `source ${date}; calculated ${saved.computed_at}`,
                    provenance: [
                      `${NATIONAL.dataset}/pra-native-1/${saved.batch_key}`,
                    ],
                    quality_flags: [
                      ...saved.quality_flags,
                      "coastal_representativeness_not_guaranteed",
                    ],
                  };
                  const list = grouped.get(row.pra) ?? [];
                  list.push(
                    qualify(row, saved.coverage[fields.indexOf(variables[0])]),
                  );
                  grouped.set(row.pra, list);
                }
                return;
              }
              const pages = await Promise.all(
                rule!.variables
                  .filter((v) => v !== "humidity")
                  .map(async (variable) => ({
                    variable,
                    rows: await retainedDay(date, variable),
                  })),
              );
              for (const pra of identities.ids) {
                const selected = pages.map((p) => ({
                  variable: p.variable,
                  row: p.rows.find((r) => r.pra_id === pra),
                }));
                const row: SupportedDay & QualifiedDay = {
                  pra,
                  date,
                  climate_support: {id: `${NATIONAL.dataset}/pra-native-1`, fraction: selected[0]?.row?.current_coverage ?? 0, temporal_complete: selected.every(p => p.row?.current_status === "available"), mask: "native_valid_cells", method: "pra-native-1"},
                  source_coverage: selected[0]?.row?.current_coverage ?? 0,
                  values: Object.fromEntries(
                    selected.map((p) => [
                      p.variable,
                      p.row?.current_value ?? null,
                    ]),
                  ),
                  compatible: true,
                  complete:
                    !rule!.variables.includes("humidity") &&
                    selected.every(
                      (p) =>
                        p.row?.current_status === "available" &&
                        (p.row.current_coverage ?? 0) >= 0.9999,
                    ),
                  source: "era5-land",
                  run: null,
                  nature: "reanalysis",
                  freshness: `source ${date}`,
                  provenance: [
                    `${NATIONAL.dataset}/pra-native-1/${date}/verified-archive-or-retained-national-data`,
                  ],
                  quality_flags: ["coastal_representativeness_not_guaranteed"],
                };
                const list = grouped.get(pra) ?? [];
                list.push(
                  qualify(row, selected[0]?.row?.current_coverage ?? undefined),
                );
                grouped.set(pra, list);
              }
            }),
        );
    }
    const began = performance.now();
    const data = identities.ids.map((pra) =>
      (unified ? calculateQualified : useSupport ? calculateObserved : calculate)(
        pra,
        grouped.get(pra) ?? [],
        start,
        end,
        rule!,
        threshold,
      ),
    );
    const complementary =
      temporal === "history" && rule!.version === NATIVE_RULE_VERSION
        ? await coastalComplement(rule!, start, end, threshold)
        : undefined;
    if (complementary) {
      const crozon = data.find((r) => r.territoryId === "pra:29102");
      if (crozon && crozon.value === null && crozon.observed_value == null)
        crozon.complementary = complementary;
    }
    const payload = {
      contract_version: "agroclimatic-1",
      rule: rule!,
      parameters: { threshold },
      period: { start, end, timezone: "UTC" },
      temporal,
      source_version: version,
      run: document?.run ?? null,
      calculated_at: new Date().toISOString(),
      calculation_ms: performance.now() - began,
      data,
    };
    return payload;
  }
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 60000, value });
  void value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return project(await value);
  function project(payload: AgroPayload): AgroPayload {
    return {
      ...payload,
      data: payload.data.map((r) => ({
        ...r,
        series: r.territoryId === pra ? r.series : [],
        signals: r.territoryId === pra ? r.signals : [],
      })),
    };
  }
}
export async function readAgroclimatic(request: Request) {
  try {
    return Response.json(
      await agroclimaticData(new URL(request.url).searchParams),
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    const safe =
      error instanceof ApiError
        ? error
        : new ApiError("UPSTREAM_UNAVAILABLE", 503);
    return Response.json(
      { error: safe.code },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
