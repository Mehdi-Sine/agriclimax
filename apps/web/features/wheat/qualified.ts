import {
  calculate,
  type AgroResult,
  type InputDay,
} from "../agroclimatic/calculate";
import { RULES, type Rule } from "../agroclimatic/catalogue";
import { calendarDays } from "../national/daily-availability";

// An additive calculation version: legacy APIs, observed-area policies and cattle stay unchanged.
export const WHEAT_VERSION = "wheat-descriptive-2.0.0";
export const WHEAT_IDS = [
  "gdd",
  "hot",
  "hot_sequence",
  "frost",
  "frost_sequence",
  "rain",
  "heavy_rain",
  "dry",
  "dry_sequence",
  "temperature_mean",
] as const;
export type WheatId = (typeof WHEAT_IDS)[number];
export const WHEAT_LIMITS =
  "Mesure climatique descriptive exploratoire sur PRA, sans validation de risque agronomique. Seuils conventionnels ; aucun stade, dommage, rendement ou hectare touché inféré. Extrêmes échantillonnés ; représentativité littorale non garantie. RPG : présence déclarée, culture actuelle inconnue.";
export const wheatRules = WHEAT_IDS.map((id) => ({
  ...RULES.find((r) => r.id === id && r.production === "wheat")!,
  version: WHEAT_VERSION,
}));
export const qualification = {
  version: WHEAT_VERSION,
  calculation: "technically_validated" as const,
  scientific_status: "exploratory" as const,
  agronomic_interpretation: "not_validated" as const,
  descriptive_publication: true,
  required_quality: "complete_homogeneous_whole_pra",
  limits: WHEAT_LIMITS,
};
export interface WheatDay extends InputDay {
  climate_support?: import("../climate-quality/calculate").QualifiedDay["climate_support"];
  support_key: string;
  spatial_coverage: number;
  temporal_coverage: number;
}
export function calculateWheat(
  pra: string,
  rows: WheatDay[],
  start: string,
  end: string,
  rule: Rule,
): AgroResult {
  if (
    !WHEAT_IDS.some((id) => id === rule.id) ||
    rule.version !== WHEAT_VERSION ||
    rule.production !== "wheat"
  )
    throw new Error("UNQUALIFIED_WHEAT_RULE");
  const supports = new Set(rows.map((r) => r.support_key));
  const metadata = rows.every(
    (r) =>
      r.support_key &&
      r.source &&
      r.provenance.length &&
      r.freshness &&
      ["forecast", "reanalysis", "observation"].includes(r.nature) &&
      (r.nature !== "forecast" ||
        (r.run && Number.isFinite(Date.parse(r.run)))),
  );
  const stable = supports.size <= 1 && metadata;
  const prepared = rows.map((r) => ({
    ...r,
    compatible: r.compatible && stable,
    complete:
      r.complete &&
      Object.entries(r.values).every(
        ([key, value]) =>
          !key.startsWith("temperature") ||
          value == null ||
          (Number.isFinite(value) && value >= -100 && value <= 60),
      ) &&
      (r.values.temperature_min == null ||
        r.values.temperature_max == null ||
        r.values.temperature_min <= r.values.temperature_max) &&
      (r.values.temperature == null ||
        r.values.temperature_min == null ||
        r.values.temperature >= r.values.temperature_min) &&
      (r.values.temperature == null ||
        r.values.temperature_max == null ||
        r.values.temperature <= r.values.temperature_max) &&
      Number.isFinite(r.spatial_coverage) &&
      r.spatial_coverage >= 0.9999 &&
      r.spatial_coverage <= 1.0001 &&
      r.temporal_coverage === 1,
  }));
  const result = calculate(pra, prepared, start, end, rule, rule.threshold);
  const partialSupport =
    stable &&
    rows.some((r) => r.spatial_coverage > 0 && r.spatial_coverage < 0.9999);
  return {
    ...result,
    status: result.value === null && partialSupport ? "partial" : result.status,
    support_scope: result.value === null ? "unavailable" : "whole_pra",
    spatial_coverage: rows.length
      ? Math.min(...rows.map((r) => r.spatial_coverage))
      : 0,
    temporal_coverage: result.coverage,
    reason: !stable
      ? "incompatible_or_missing_support_metadata"
      : partialSupport
        ? "incomplete_source_support"
        : result.reason,
    quality_flags: [
      ...new Set([
        ...result.quality_flags,
        ...(!stable ? ["incompatible_or_missing_support_metadata"] : []),
        "descriptive_only_no_agronomic_risk",
      ]),
    ],
  };
}
export function isPublishable(rule: Rule, result: AgroResult): boolean {
  const registered = wheatRules.find((r) => r.id === rule.id);
  return (
    !!registered &&
    JSON.stringify(rule) === JSON.stringify(registered) &&
    result.rule_version === WHEAT_VERSION &&
    result.unit === rule.unit &&
    result.parameters.threshold === rule.threshold &&
    result.status === "available" &&
    result.value !== null &&
    Number.isFinite(result.value) &&
    result.coverage === 1 &&
    result.temporal_coverage === 1 &&
    result.spatial_coverage! >= 0.9999 &&
    result.support_scope === "whole_pra" &&
    result.reason === null &&
    result.provenance.length > 0 &&
    result.data_freshness.length > 0
  );
}
export function wheatPeriod(start: string, end: string) {
  const days = calendarDays(start, end);
  if (!days.length || days.length > 30) throw new Error("INVALID_WHEAT_PERIOD");
  return days;
}
