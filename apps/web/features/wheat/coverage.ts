import {calculateQualified, coverageRule, type QualifiedDay} from "../climate-quality/calculate";
import {wheatRules, WHEAT_IDS, qualification, WHEAT_LIMITS} from "./qualified";
import type {Rule} from "../agroclimatic/catalogue";
import type {AgroResult} from "../agroclimatic/calculate";
export const COVERAGE_WHEAT_VERSION = "wheat-descriptive-2.1.0";
export const coverageWheatRules = wheatRules.map(r => coverageRule(r, COVERAGE_WHEAT_VERSION));
export const coverageQualification = {...qualification, version: COVERAGE_WHEAT_VERSION, required_quality: "versioned_coverage_policy; observed_values_separate; journal_whole_pra_only", limits: WHEAT_LIMITS};
export function calculateCoverageWheat(pra: string, rows: QualifiedDay[], start: string, end: string, rule: Rule): AgroResult {
  if (!WHEAT_IDS.some(id => id === rule.id) || rule.version !== COVERAGE_WHEAT_VERSION || rule.production !== "wheat") throw Error("UNQUALIFIED_WHEAT_RULE");
  return calculateQualified(pra, rows.map(r => ({...r, complete: r.complete && Object.entries(r.values).every(([k,v]) => !k.startsWith("temperature") || v == null || (Number.isFinite(v) && v >= -100 && v <= 60)) && (r.values.temperature_min == null || r.values.temperature_max == null || r.values.temperature_min <= r.values.temperature_max) && (r.values.temperature == null || r.values.temperature_min == null || r.values.temperature >= r.values.temperature_min) && (r.values.temperature == null || r.values.temperature_max == null || r.values.temperature <= r.values.temperature_max)})), start, end, rule, rule.threshold);
}
export function coverageWheatPublishable(rule: Rule, r: AgroResult): boolean {
  const registered=coverageWheatRules.find(one => one.id === rule.id);
  return !!registered && (registered === rule || JSON.stringify(registered) === JSON.stringify(rule)) && r.rule_version === COVERAGE_WHEAT_VERSION && r.unit === rule.unit && r.parameters.threshold === rule.threshold && !!r.quality?.journal_eligible && r.value !== null && Number.isFinite(r.value) && r.provenance.length > 0 && r.data_freshness.length > 0;
}
