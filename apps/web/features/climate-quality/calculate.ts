import {calculate, type InputDay, type AgroResult} from "../agroclimatic/calculate";
import type {Rule} from "../agroclimatic/catalogue";
import {calendarDays} from "../national/daily-availability";
import {indicatorFamily, qualifyCoverage, type CoverageEvidence} from "./policy";
export const UNIFIED_AGRO_VERSION = "agroclimatic-1.3.0";
export function coverageRule(rule: Rule, version = UNIFIED_AGRO_VERSION): Rule {
  return {...rule, version, coverage_family: rule.coverage_family ?? indicatorFamily(rule.id),
    quality: "Contrat climate-coverage-1 : support identifié et compatible, période complète ; valeur descriptive de portion séparée. Toute estimation territoriale exige un certificat enregistré.",
    limits: rule.limits + " Sur support partiel, aucune généralisation à la PRA entière sans qualification explicite."};
}
export interface QualifiedDay extends InputDay {
  climate_support?: {
    id: string;
    identity?: string;
    fraction: number;
    temporal_complete: boolean;
    mask: CoverageEvidence["mask"];
    represented_area_m2?: number;
    estimate_certificate?: string;
    method: string;
  };
}
/** Reuse the scientific formulae. Only the admissibility and scope are new. */
export function calculateQualified(pra: string, rows: QualifiedDay[], start: string, end: string, rule: Rule, threshold: number | null): AgroResult {
  const dates = calendarDays(start, end);
  const supportKeys = new Set(rows.map(r => r.climate_support ? r.climate_support.identity ?? r.climate_support.id : undefined));
  const fractions = rows.map(r => r.climate_support?.fraction ?? NaN);
  const metadata = rows.every(r => r.source && r.freshness && r.provenance.length > 0 && ["forecast", "forecast_based_recent_estimate", "reanalysis", "observation", "analysis"].includes(r.nature) && (r.nature !== "forecast" || (r.run !== null && Number.isFinite(Date.parse(r.run)))) && r.climate_support?.method);
  const stable = metadata && supportKeys.size === 1 && !supportKeys.has(undefined) && fractions.every(f => Number.isFinite(f) && Math.abs(f - fractions[0]) < 1e-7);
  const prepared = rows.map(r => ({...r, compatible: r.compatible && stable, complete: r.complete && !!r.climate_support?.temporal_complete}));
  const calculated = calculate(pra, prepared, start, end, rule, threshold);
  const first = rows[0]?.climate_support;
  const quality = qualifyCoverage(calculated.value, rule.coverage_family ?? indicatorFamily(rule.id), {
    fraction: fractions.length && fractions.every(Number.isFinite) ? Math.min(...fractions) : null,
    support_id: stable ? first!.id : null,
    mask: first?.mask ?? "unknown", represented_area_m2: first?.represented_area_m2 ?? null,
    expected_days: dates.length, available_days: calculated.observedDays,
    continuous: calculated.observedDays === dates.length, homogeneous: stable && !calculated.quality_flags.includes("incompatible_sources_or_runs"),
    method: first?.method ?? "", estimate_certificate: rows.length && rows.every(r => r.climate_support?.estimate_certificate === first?.estimate_certificate) ? first?.estimate_certificate ?? null : null,
    reference_compatible: false,
  });
  const descriptive = quality.state === "observed_partial";
  const eligible = quality.indicator_eligible;
  return {...calculated, quality, value: eligible && !descriptive ? calculated.value : null,
    observed_value: descriptive || quality.state === "qualified_estimate" ? calculated.value : null,
    support_id: quality.evidence.support_id,
    support_scope: descriptive ? "observed_area" : quality.state === "qualified_estimate" ? "qualified_pra_estimate" : eligible ? "whole_pra" : "unavailable",
    spatial_coverage: quality.evidence.fraction ?? 0, temporal_coverage: calculated.coverage,
    status: quality.state === "native_complete" ? "available" : rows.some(r => r.complete || (r.climate_support?.fraction ?? 0) > 0) ? "partial" : "unavailable",
    reason: eligible ? quality.reason : calculated.reason ?? quality.reason,
    signals: eligible ? calculated.signals : [],
    series: calculated.series.map(day => ({...day, support_id: rows.find(row => row.date === day.date)?.climate_support?.id ?? null})),
    quality_flags: [...new Set([...calculated.quality_flags, ...(quality.reason ? [quality.reason] : []), ...(descriptive ? ["observed_area_not_whole_pra", "no_homologous_normal_or_anomaly"] : [])])],
  };
}
