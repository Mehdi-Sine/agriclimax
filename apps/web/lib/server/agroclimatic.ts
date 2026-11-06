import "server-only";
import { createHash } from "node:crypto";
import identities from "../../data/operational/pra-identities.json";
import { RULES, type Rule } from "../../features/agroclimatic/catalogue";
import {
  calculate,
  type InputDay,
  type AgroResult,
} from "../../features/agroclimatic/calculate";
import { calendarDays } from "../../features/national/daily-availability";
import { NATIONAL } from "../../features/national/model";
import { nationalWeatherDocument, archivedEra5Day } from "./weather-archives";
import { nationalData } from "./national";
import { nationalDays } from "./national-availability";
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
export async function agroclimaticData(params: URLSearchParams) {
  const allowed = [
    "indicator",
    "threshold",
    "temporal",
    "start",
    "end",
    "run",
    "pra",
  ];
  const pra = params.get("pra");
  if (pra && !identities.ids.includes(pra))
    throw new ApiError("INVALID_QUERY", 400);
  const rule = RULES.find((r) => r.id === params.get("indicator"));
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
    const grouped = new Map<string, InputDay[]>();
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
        const first = rows[0],
          needed = rows.filter((r) => rule!.variables.includes(r.variable));
        const row: InputDay = {
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
          complete:
            needed.length === rule!.variables.length &&
            needed.every(
              (r) =>
                r.status === "available" &&
                r.spatial_coverage >= 0.9999 &&
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
                  const row: InputDay = {
                    pra: saved.pra_id,
                    date,
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
                  list.push(row);
                  grouped.set(row.pra, list);
                }
                return;
              }
              const pages = await Promise.all(
                rule!.variables
                  .filter((v) => v !== "humidity")
                  .map(async (variable) => ({
                    variable,
                    rows: (
                      await nationalData(
                        new URLSearchParams({
                          action: "context-day",
                          date,
                          variable,
                          storage: "cold",
                        }),
                      )
                    ).data as ClimateContextRow[],
                  })),
              );
              for (const pra of identities.ids) {
                const selected = pages.map((p) => ({
                  variable: p.variable,
                  row: p.rows.find((r) => r.pra_id === pra),
                }));
                const row: InputDay = {
                  pra,
                  date,
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
                list.push(row);
                grouped.set(pra, list);
              }
            }),
        );
    }
    const began = performance.now();
    const data = identities.ids.map((pra) =>
      calculate(pra, grouped.get(pra) ?? [], start, end, rule!, threshold),
    );
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
