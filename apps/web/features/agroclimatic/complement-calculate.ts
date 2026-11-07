import { calculate } from "./calculate";
import type { Rule } from "./catalogue";
import { calendarDays } from "../national/daily-availability";
import type { ComplementaryDay, ComplementaryValue } from "./complement-model";

// A separate modeled value never changes the native NULL or its observed coverage.
export function calculateComplementary(
  pra: string,
  rows: ComplementaryDay[],
  start: string,
  end: string,
  rule: Rule,
  threshold: number | null,
  certificate: {
    source_id: string;
    method_version: string;
    accepted: boolean;
    validation: ComplementaryValue["validation"];
    quality_flags: string[];
  },
): ComplementaryValue | undefined {
  const dates = calendarDays(start, end);
  if (
    pra !== "pra:29102" ||
    !["temperature_mean", "gdd", "rain"].includes(rule.id) ||
    !certificate.accepted ||
    !dates.length ||
    dates.length > 30 ||
    rows.length !== dates.length ||
    new Set(rows.map((r) => r.date)).size !== dates.length ||
    dates.some((d) => !rows.some((r) => r.date === d)) ||
    new Set(rows.map((r) => r.identity + "/" + r.support_id)).size !== 1 ||
    rows.some(
      (r) =>
        r.native_coverage !== 0 ||
        r.temporal_coverage !== 1 ||
        typeof r.support_id !== "string" ||
        !/^[a-f0-9]{64}$/.test(r.support_id) ||
        r.value === null ||
        !Number.isFinite(r.value),
    )
  )
    return undefined;
  const result = calculate(
    pra,
    rows.map((r) => ({
      pra,
      date: r.date,
      values: { [rule.variables[0]]: r.value },
      complete: true,
      compatible: true,
      source: certificate.source_id,
      run: null,
      nature: "spatial_reconstruction",
      freshness: "historical_reconstructed",
      provenance: [r.provenance],
      quality_flags: certificate.quality_flags,
    })),
    start,
    end,
    rule,
    threshold,
  );
  if (result.value === null) return undefined;
  return {
    value: result.value,
    unit: rule.unit,
    rule_version: rule.version,
    data_freshness: result.data_freshness,
    source_id: certificate.source_id,
    source_kind: "spatial_reconstruction",
    method_version: certificate.method_version,
    native_spatial_coverage: 0,
    temporal_coverage: 1,
    days: dates.length,
    support_id: rows[0].support_id,
    scientific_status: "exploratory",
    validation: certificate.validation,
    provenance: result.provenance,
    quality_flags: certificate.quality_flags,
    series: result.series.map((r) => ({
      date: r.date,
      input_value: rows.find((d) => d.date === r.date)!.value!,
      value: r.value!,
    })),
  };
}
