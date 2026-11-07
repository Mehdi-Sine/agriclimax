import "server-only";
import { observedSupportDay } from "./spatial-restitution";
import {
  calculateObserved,
  observedRule,
  type SupportedDay,
  NATIVE_RULE_VERSION,
  OBSERVED_RULE_VERSION,
} from "../../features/agroclimatic/observed-support";
import { RULES } from "../../features/agroclimatic/catalogue";
import { nationalData } from "./national";
import { ApiError } from "./query";
import {
  NATIONAL,
  type ClimateContextRow,
  type ClimateVariable,
} from "../../features/national/model";
import { aggregate, INDICATORS } from "../../features/unified/model";
import { nationalDays } from "./national-availability";
import {
  calendarDays,
  withinAvailable,
} from "../../features/national/daily-availability";

// At most 60 map days retained, five minutes; no failed requests cached.
const cache = new Map<
  string,
  { expires: number; promise: Promise<ClimateContextRow[]> }
>();
function day(
  date: string,
  variable: ClimateVariable,
  transport: typeof fetch,
  cold = false,
) {
  const key = `${date}:${variable}:${cold}`;
  const hit = cache.get(key);
  if (transport === fetch && hit && hit.expires > Date.now())
    return hit.promise;
  const promise = nationalData(
    new URLSearchParams({
      action: "context-day",
      date,
      variable,
      ...(cold ? { storage: "cold" } : {}),
    }),
    transport,
  ).then((r) =>
    (r.data as ClimateContextRow[]).map((row) => ({ ...row, date })),
  );
  if (transport === fetch) {
    if (cache.size >= 60) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 300000, promise });
    void promise.catch(() => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
    });
  }
  return promise;
}
export async function unifiedData(
  params: URLSearchParams,
  transport: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  const allowed = [
    "start",
    "end",
    "indicator",
    "threshold",
    "storage",
    "rule_version",
  ];
  const cold = params.get("storage") === "cold";
  const requestedVersion = params.get("rule_version");
  if (
    requestedVersion &&
    ![
      "agroclimatic-1.0.0",
      OBSERVED_RULE_VERSION,
      NATIVE_RULE_VERSION,
    ].includes(requestedVersion)
  )
    throw new ApiError("INVALID_QUERY", 400);
  if (params.has("storage") && !cold) throw new ApiError("INVALID_QUERY", 400);
  const start = params.get("start") ?? "",
    end = params.get("end") ?? "",
    id = params.get("indicator") ?? "";
  const definition = INDICATORS.find((i) => i.id === id);
  const threshold = Number(
    params.get("threshold") ?? definition?.parameter ?? 25,
  );
  const availableDays = await nationalDays(transport, [start, end]);
  const dates = calendarDays(start, end);
  if (
    [...params.keys()].some(
      (k) => !allowed.includes(k) || params.getAll(k).length !== 1,
    ) ||
    !withinAvailable(start, availableDays) ||
    !withinAvailable(end, availableDays) ||
    !dates.length ||
    dates.some((d) => !withinAvailable(d, availableDays)) ||
    dates.length > 30 ||
    !definition ||
    !Number.isFinite(threshold) ||
    threshold < -30 ||
    threshold > 60
  )
    throw new ApiError("INVALID_QUERY", 400);
  if (process.env.PRA_NATIONAL_ENABLED !== "1")
    throw new ApiError("NOT_CONFIGURED", 503);
  const grouped = new Map<string, ClimateContextRow[]>();
  // Four dates in flight (four paginated RPC requests concurrently); no annual series sent to client.
  for (let i = 0; i < dates.length; i += 4) {
    if (signal?.aborted) throw new ApiError("UPSTREAM_UNAVAILABLE", 503);
    const pages = await Promise.all(
      dates
        .slice(i, i + 4)
        .map((date) => day(date, definition.variable, transport, cold)),
    );
    for (const rows of pages)
      for (const row of rows) {
        const list = grouped.get(row.pra_id!) ?? [];
        list.push(row);
        grouped.set(row.pra_id!, list);
      }
  }
  let data = [...grouped.values()].map((rows) => ({
    ...aggregate(rows, definition, dates.length, threshold),
    freshness: `ERA5-Land · source ${end} UTC`,
  }));
  if (
    requestedVersion !== "agroclimatic-1.0.0" &&
    [
      "temperature",
      "temperature_min",
      "temperature_max",
      "hot",
      "frost",
      "gdd",
      "rain",
    ].includes(id) &&
    (requestedVersion !== OBSERVED_RULE_VERSION ||
      ["temperature", "gdd", "rain"].includes(id)) &&
    data.some((r) => r.status !== "available")
  ) {
    const rule = observedRule(
      ["temperature_min", "temperature_max"].includes(id)
        ? {
            ...RULES.find((r) => r.id === "temperature_mean")!,
            id,
            variables: [definition.variable],
            formula: definition.method,
          }
        : RULES.find(
            (r) => r.id === (id === "temperature" ? "temperature_mean" : id),
          )!,
      requestedVersion ?? NATIVE_RULE_VERSION,
    );
    const documents = await Promise.all(
      dates.map((date) =>
        observedSupportDay(
          date,
          definition.variable,
          requestedVersion === OBSERVED_RULE_VERSION,
        ),
      ),
    );
    const byDate = new Map(dates.map((date, i) => [date, documents[i]]));
    data = data.map((result) => {
      if (result.status === "available") return result;
      const native = grouped.get(result.territoryId) ?? [];
      const inputs: SupportedDay[] = native.map((r) => {
        const doc = byDate.get(r.date!)!,
          p = doc.rows.find((p) => p.pra_id === result.territoryId);
        const valid =
          !!doc.verified &&
          !!p?.support_id &&
          !!doc.geometries[p.support_id] &&
          p.observed_value !== null &&
          p.coverage > 0 &&
          p.temporal_coverage === 1 &&
          r.current_coverage != null &&
          Math.abs(r.current_coverage - p.coverage) < 1e-5;
        return {
          pra: result.territoryId,
          date: r.date!,
          source_coverage: r.current_coverage ?? 0,
          values: {
            [definition.variable]: valid ? p!.observed_value : r.current_value,
          },
          complete:
            valid ||
            (r.current_status === "available" &&
              (r.current_coverage ?? 0) >= 0.9999),
          compatible: true,
          source: "era5-land",
          run: null,
          nature: "reanalysis",
          freshness: result.freshness,
          provenance: [
            result.provenance,
            `${doc.identity}/${r.date}/${doc.data_sha256}`,
          ],
          quality_flags: result.quality_flags,
          ...(valid
            ? {
                support: {
                  id: p!.support_id!,
                  identity: doc.identity,
                  coverage: p!.coverage,
                  temporal_coverage: p!.temporal_coverage,
                },
              }
            : {}),
        };
      });
      const next = calculateObserved(
        result.territoryId,
        inputs,
        start,
        end,
        rule,
        threshold,
      );
      return {
        ...result,
        ...next,
        observed_series: next.series.map((r) => ({
          date: r.date,
          value:
            r.support_id &&
            r.support_id === next.series.find((p) => p.support_id)?.support_id
              ? id === "gdd"
                ? r.temperature
                : r.value
              : null,
        })),
        provenance: next.provenance.join(" · "),
        coverage: next.spatial_coverage ?? result.coverage,
      };
    });
  }
  return {
    period: [start, end],
    indicator: id,
    threshold,
    source_id: "era5-land",
    dataset_version: NATIONAL.dataset,
    data,
  };
}
export async function readUnified(request: Request) {
  try {
    return Response.json(
      await unifiedData(
        new URL(request.url).searchParams,
        fetch,
        request.signal,
      ),
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (e) {
    const safe =
      e instanceof ApiError ? e : new ApiError("UPSTREAM_UNAVAILABLE", 502);
    return Response.json(
      { error: safe.code },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
