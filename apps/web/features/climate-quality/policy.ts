import policy from "../../../../config/climate-coverage-1.json";
export const COVERAGE_VERSION = policy.version;
export type Family = keyof typeof policy.families;
export type CoverageState = "native_complete" | "observed_partial" | "qualified_estimate" | "unavailable" | "unknown";
/** Adapter evidence, never inferred from the numeric value or a UI status. */
export interface CoverageEvidence {
  fraction: number | null;
  support_id: string | null;
  mask: "physical_land" | "geometric_proxy" | "native_valid_cells" | "unknown";
  represented_area_m2: number | null;
  expected_days: number;
  available_days: number;
  continuous: boolean;
  homogeneous: boolean;
  method: string;
  // A reviewed, versioned certificate, not a coverage threshold.
  estimate_certificate: string | null;
  reference_compatible: boolean;
}
export interface CoverageQuality {
  version: string;
  state: CoverageState;
  numeric_value: boolean;
  scope: "whole_pra" | "observed_area" | "unavailable";
  scientific_status: "exploratory";
  indicator_eligible: boolean;
  journal_eligible: boolean;
  reason: string | null;
  evidence: CoverageEvidence;
}
export function indicatorFamily(id: string): Family {
  if (["temperature", "temperature_mean", "gdd", "rain"].includes(id)) return "mean_sum";
  if (["dry_sequence", "hot_sequence", "frost_sequence"].includes(id)) return "sequence";
  if (["temperature_min", "temperature_max", "hot", "frost", "dry", "heavy_rain", "cattle_heat"].includes(id)) return "extreme_event";
  return "specific";
}
export interface EstimateCertificate {method: string; support_ids: string[]; evidence_ids: string[]}
export function qualifyCoverage(value: number | null, family: Family, e: CoverageEvidence, certificates: Record<string,EstimateCertificate> = policy.estimate_certificates): CoverageQuality {
  const certificate = e.estimate_certificate ? certificates[e.estimate_certificate] : undefined;
  const certified = certificate?.method === e.method && !!e.support_id && certificate.support_ids.includes(e.support_id) && certificate.evidence_ids.length > 0;
  const numeric = value !== null && Number.isFinite(value);
  const fractionValid = e.fraction !== null && Number.isFinite(e.fraction) && e.fraction >= 0 && e.fraction <= 1 + policy.complete_tolerance;
  const temporal = Number.isInteger(e.expected_days) && e.expected_days > 0 && e.available_days === e.expected_days && e.continuous && e.homogeneous;
  const identified = !!e.support_id && !!e.method;
  let state: CoverageState = "unavailable", reason: string | null = null;
  if (!fractionValid || !identified) { state = "unknown"; reason = "missing_support_metadata"; }
  else if (!numeric || e.fraction === 0) reason = "value_unavailable";
  else if (!temporal) reason = "incomplete_or_incompatible_period";
  else if (family === "normal_anomaly" && !e.reference_compatible) reason = "incompatible_reference";
  else if (e.fraction! >= 1 - policy.complete_tolerance) state = "native_complete";
  else if (policy.families[family].estimate && e.fraction! >= policy.estimate_minimum_fraction && certified && e.mask === "native_valid_cells") state = "qualified_estimate";
  else if (policy.families[family].observed) { state = "observed_partial"; reason = "observed_area_only"; }
  else reason = "complete_support_required";
  const eligible = ["native_complete", "qualified_estimate", "observed_partial"].includes(state);
  return {version: COVERAGE_VERSION, state, numeric_value: numeric, scope: state === "observed_partial" ? "observed_area" : eligible ? "whole_pra" : "unavailable", scientific_status: "exploratory", indicator_eligible: eligible, journal_eligible: eligible && state !== "observed_partial", reason, evidence: e};
}
export type PackedCoverageQuality = Omit<CoverageQuality,"evidence"> & {evidence: Omit<CoverageEvidence,"fraction"|"support_id">};
export const qualityLabel = (q: CoverageQuality) => ({native_complete: "Support natif complet", observed_partial: "Valeur sur support observé uniquement", qualified_estimate: "Estimation territoriale qualifiée", unavailable: "Résultat non évaluable", unknown: "Qualité du support inconnue"})[q.state];
