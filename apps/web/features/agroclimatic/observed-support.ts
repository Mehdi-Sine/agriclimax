import { calculate, type InputDay, type AgroResult } from "./calculate";
import type { Rule } from "./catalogue";
export const NATIVE_RULE_VERSION = "agroclimatic-1.2.0";
export const OBSERVED_RULE_VERSION = "agroclimatic-1.1.0";
export const STRICT_RULE_VERSION = "agroclimatic-1.0.0";
export const supportPolicy = (
  rule: Rule,
): "qualified_mean" | "event_on_support" | null =>
  ["gdd", "temperature_mean", "rain"].includes(rule.id)
    ? "qualified_mean"
    : [
          "dry",
          "dry_sequence",
          "heavy_rain",
          "hot",
          "hot_sequence",
          "frost",
          "frost_sequence",
          "cattle_heat",
        ].includes(rule.id)
      ? "event_on_support"
      : null;
export interface ObservedSupport {
  id: string;
  identity: string;
  coverage: number;
  temporal_coverage: number;
}
export type SupportedDay = InputDay & {
  support?: ObservedSupport;
  source_coverage?: number;
};
export function observedRule(
  rule: Rule,
  version = OBSERVED_RULE_VERSION,
): Rule {
  return {
    ...rule,
    version,
    quality:
      rule.quality +
      (version === NATIVE_RULE_VERSION
        ? " Support natif stable ; estimation qualifiée ≥90% uniquement pour Tmoy/GDD/pluie. Événements et extrema natifs limités aux cellules couvertes, sans extrapolation."
        : " Support observé natif stable sur toute la période ; estimation qualifiée ≥90% uniquement pour moyennes/GDD/pluie. Événements de pluie limités à la moyenne du support."),
    limits:
      rule.limits +
      " Les valeurs sur portion renseignée ne décrivent pas la PRA entière ; aucune normale ni anomalie reconstruite.",
  };
}
export function calculateObserved(
  pra: string,
  rows: SupportedDay[],
  start: string,
  end: string,
  rule: Rule,
  threshold: number | null,
): AgroResult {
  const result = calculate(pra, rows, start, end, rule, threshold);
  const partial = rows.filter((r) => r.support),
    supports = new Set(
      partial.map((r) => `${r.support!.identity}/${r.support!.id}`),
    );
  const incompatible =
    partial.length > 0 &&
    (supports.size > 1 ||
      rows.some((r) => r.complete && !r.support) ||
      partial.some(
        (r) =>
          Math.abs(r.support!.coverage - partial[0].support!.coverage) > 1e-7,
      ));
  const coverage = partial.length
    ? Math.min(...partial.map((r) => r.support!.coverage))
    : rows.length
      ? Math.min(...rows.map((r) => r.source_coverage ?? 1))
      : 0;
  const temporal = result.coverage;
  const observed = !incompatible ? result.value : null;
  const qualified =
    partial.length > 0 &&
    supportPolicy(rule) === "qualified_mean" &&
    coverage >= 0.9;
  const value = partial.length ? (qualified ? observed : null) : result.value;
  const reason = incompatible
    ? "incompatible_spatial_support"
    : partial.length && observed !== null
      ? qualified
        ? "qualified_spatial_estimate"
        : "observed_area_only"
      : result.reason;
  return {
    ...result,
    value,
    observed_value: partial.length ? observed : null,
    support_id:
      partial.length && observed !== null ? partial[0].support!.id : null,
    support_scope: partial.length
      ? observed !== null
        ? qualified
          ? "qualified_pra_estimate"
          : "observed_area"
        : "unavailable"
      : result.value !== null
        ? "whole_pra"
        : "unavailable",
    spatial_coverage: coverage,
    temporal_coverage: temporal,
    status:
      partial.length || incompatible
        ? result.observedDays
          ? "partial"
          : "unavailable"
        : result.status,
    reason,
    episodes: incompatible || result.value === null ? null : result.episodes,
    longest: incompatible || result.value === null ? null : result.longest,
    series: result.series.map((r) => ({
      ...r,
      support_id: rows.find((d) => d.date === r.date)?.support?.id ?? null,
    })),
    quality_flags: [
      ...new Set([
        ...result.quality_flags,
        ...(partial.length
          ? [
              "observed_area_not_whole_pra",
              "stable_native_mask_required",
              "no_homologous_normal_or_anomaly",
            ]
          : []),
        ...(incompatible ? ["incompatible_spatial_support"] : []),
        ...(supportPolicy(rule) === "event_on_support"
          ? [
              rule.variables[0] === "precipitation"
                ? "event_of_spatial_mean_not_fraction_of_affected_area"
                : "event_of_native_extreme_on_observed_support_only",
            ]
          : []),
      ]),
    ],
  };
}
