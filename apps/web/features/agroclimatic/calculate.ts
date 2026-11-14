import type { ComplementaryValue } from "./complement-model";
import { thi } from "../cattle/thi";
import { calendarDays } from "../national/daily-availability";
import type { WeatherVariable } from "../operational/model";
import type { Rule } from "./catalogue";
export interface InputDay {
  pra: string;
  date: string;
  values: Partial<Record<WeatherVariable, number | null>>;
  compatible: boolean;
  complete: boolean;
  source: string;
  run: string | null;
  nature: string;
  freshness: string;
  provenance: string[];
  quality_flags: string[];
}
export interface AgroResult {
  quality?: import("../climate-quality/policy").CoverageQuality;
  complementary?: ComplementaryValue;
  observed_value?: number | null;
  support_id?: string | null;
  support_scope?:
    | "whole_pra"
    | "qualified_pra_estimate"
    | "observed_area"
    | "unavailable";
  spatial_coverage?: number;
  temporal_coverage?: number;
  territoryId: string;
  value: number | null;
  normal: null;
  anomaly: null;
  status: "available" | "partial" | "unavailable";
  reason: string | null;
  unit: string;
  observedDays: number;
  expectedDays: number;
  coverage: number;
  rule_version: string;
  parameters: { threshold: number | null };
  data_freshness: string[];
  provenance: string[];
  quality_flags: string[];
  scientific_status: "exploratory";
  episodes: number | null;
  longest: number | null;
  signals: {
    date: string;
    territory: string;
    variable: string;
    value: number;
    threshold: number;
    comparison: string;
    source: string | null;
    run: string | null;
  }[];
  series: {
    date: string;
    support_id?: string | null;
    temperature: number | null;
    value: number | null;
    source: string | null;
    run: string | null;
    nature: string | null;
  }[];
}
function valid(
  variable: WeatherVariable,
  value: number | null | undefined,
): value is number {
  return (
    value != null &&
    Number.isFinite(value) &&
    (variable === "humidity"
      ? value >= 0 && value <= 100
      : variable === "precipitation"
        ? value >= 0
        : value >= -273.15 && value <= 60)
  );
}
export function calculate(
  pra: string,
  rows: InputDay[],
  start: string,
  end: string,
  rule: Rule,
  threshold: number | null,
): AgroResult {
  const orderedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const dates = calendarDays(start, end);
  if (
    !dates.length ||
    dates.length > 30 ||
    (threshold !== null && !Number.isFinite(threshold)) ||
    (rule.threshold !== null && threshold === null)
  )
    throw new Error("INVALID_PERIOD_OR_PARAMETER");
  const byDate = new Map<string, InputDay>();
  for (const row of orderedRows) {
    if (row.pra !== pra || !dates.includes(row.date))
      throw new Error("OUTSIDE_INPUT");
    if (byDate.has(row.date)) throw new Error("DUPLICATE_DAY");
    byDate.set(row.date, row);
  }
  const origins = new Set(
    orderedRows.map((r) => `${r.source}/${r.run}/${r.nature}`),
  );
  const series = dates.map((date) => {
    const row = byDate.get(date);
    let value: number | null = null;
    if (
      row?.complete &&
      row.compatible &&
      rule.variables.every((v) => valid(v, row.values[v]))
    ) {
      value = rule.variables.includes("humidity")
        ? thi(row.values.temperature!, row.values.humidity!)
        : row.values[rule.variables[0]]!;
      if (rule.operator === "gdd") value = Math.max(0, value - threshold!);
    }
    return {
      date,
      temperature:
        row?.complete && valid("temperature", row.values.temperature)
          ? row.values.temperature
          : null,
      value,
      source: row?.source ?? null,
      run: row?.run ?? null,
      nature: row?.nature ?? null,
    };
  });
  const good = series.flatMap((r) => (r.value === null ? [] : [r.value]));
  const incompatible =
    origins.size > 1 || orderedRows.some((r) => !r.compatible);
  const complete = good.length === dates.length && !incompatible;
  let count = 0,
    episodes = 0,
    longest = 0,
    run = 0;
  const above = ["above", "longestAbove", "thiAbove", "thiLongest"].includes(
    rule.operator,
  );
  const inclusive = ["atLeast", "longestAtLeast"].includes(rule.operator);
  const exceeds = (value: number, limit: number) =>
    inclusive ? value >= limit : above ? value > limit : value < limit;
  for (const row of series) {
    if (
      row.value !== null &&
      threshold !== null &&
      exceeds(row.value, threshold)
    ) {
      count++;
      if (!run) episodes++;
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  const thresholdRule = !["gdd", "mean", "min", "max", "sum", "thi"].includes(rule.operator);
  const signals =
    thresholdRule && threshold !== null
      ? series.flatMap((r) =>
          r.value !== null &&
          exceeds(r.value, threshold)
            ? [
                {
                  date: r.date,
                  territory: pra,
                  variable: rule.variables.includes("humidity")
                    ? "thi"
                    : rule.variables[0],
                  value: r.value,
                  threshold,
                  comparison: inclusive ? ">=" : above ? ">" : "<",
                  source: r.source,
                  run: r.run,
                },
              ]
            : [],
        )
      : [];
  const value = !complete
    ? null
    : rule.operator === "min"
      ? Math.min(...good)
    : ["thi", "max"].includes(rule.operator)
      ? Math.max(...good)
      : ["above", "below", "thiAbove", "atLeast"].includes(rule.operator)
        ? count
        : ["longestAbove", "longestBelow", "thiLongest", "longestAtLeast"].includes(rule.operator)
          ? longest
          : rule.operator === "mean"
            ? good.reduce((a, b) => a + b, 0) / good.length
            : good.reduce((a, b) => a + b, 0);
  const partialSupport = orderedRows.some(
    (r) => !r.complete && rule.variables.some((v) => r.values[v] != null),
  );
  const humidityMissing =
    rule.variables.includes("humidity") &&
    rows.length > 0 &&
    orderedRows.every((r) => r.values.humidity == null);
  const reason = incompatible
    ? "incompatible_sources_or_runs"
    : !good.length
      ? humidityMissing
        ? "humidity_missing"
        : partialSupport
          ? "incomplete_source_support"
          : rule.variables.includes("humidity")
            ? "temperature_humidity_pair_unavailable"
            : "variable_unavailable"
      : !complete
        ? "incomplete_period"
        : null;
  return {
    territoryId: pra,
    value,
    normal: null,
    anomaly: null,
    status: complete
      ? "available"
      : good.length || partialSupport
        ? "partial"
        : "unavailable",
    reason,
    unit: rule.unit,
    observedDays: good.length,
    expectedDays: dates.length,
    coverage: good.length / dates.length,
    rule_version: rule.version,
    parameters: { threshold },
    data_freshness: [...new Set(orderedRows.map((r) => r.freshness))],
    provenance: [...new Set(orderedRows.flatMap((r) => r.provenance))],
    quality_flags: [
      ...new Set([
        ...orderedRows.flatMap((r) => r.quality_flags),
        ...(reason ? [reason] : []),
        ...(rule.variables.includes("humidity")
          ? ["synthetic_daily_not_hourly_maximum"]
          : []),
      ]),
    ],
    scientific_status: "exploratory",
    episodes: complete && thresholdRule ? episodes : null,
    longest: complete && thresholdRule ? longest : null,
    signals,
    series,
  };
}
