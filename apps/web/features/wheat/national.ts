import {calculateCoverageWheat, coverageWheatPublishable, COVERAGE_WHEAT_VERSION, coverageQualification} from "./coverage";
import { createHash } from "node:crypto";
import type { Place } from "../national-watch/model";
import type { Rule } from "../agroclimatic/catalogue";
import type { AgroResult } from "../agroclimatic/calculate";
import {
  calculateWheat,
  isPublishable,
  wheatRules,
  wheatPeriod,
  WHEAT_VERSION,
  qualification,
  type WheatDay,
} from "./qualified";
export interface WheatCoverage {
  total: number;
  evaluable: number;
  complete: number;
  partial: number;
  unavailable: number;
  reasons: Record<string, number>;
  observed_partial?: number;
  qualified_estimate?: number;
}
export interface WheatTerritorySummary {
  territory: string;
  coverage: WheatCoverage;
  positive_pra: number | null;
  maximum: {
    pra: string;
    name: string;
    value: number;
    provenance: string[];
    quality_flags: string[];
    data_freshness: string[];
    quality?: import("../climate-quality/policy").CoverageQuality;
  } | null;
}
export interface WheatSummary {
  version: string;
  identity: string;
  source_version: string;
  nature: "forecast" | "reanalysis" | "observation" | "analysis";
  run: string | null;
  period: [string, string];
  qualification: typeof qualification;
  indicators: {
    id: string;
    unit: string;
    formula: string;
    threshold: number | null;
    reference: string;
    territories: WheatTerritorySummary[];
  }[];
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function summarizeWheat(
  places: Place[],
  inputs: Record<string, WheatDay[]>,
  period: [string, string],
  source: {
    version: string;
    nature: WheatSummary["nature"];
    run: string | null;
  },
  rules: Rule[] = wheatRules,
): { summary: WheatSummary; results: Record<string, AgroResult[]> } {
  wheatPeriod(...period);
  if (
    !source.version ||
    Object.values(inputs)
      .flat()
      .some((r) => r.nature !== source.nature)
  )
    throw new Error("INCOMPATIBLE_WHEAT_SOURCE");
  if (
    !places.length ||
    new Set(places.map((p) => p.id)).size !== places.length ||
    places.some((p) => !p.region || !p.name)
  )
    throw new Error("INVALID_WHEAT_GEOGRAPHY");
  const placeById = new Map(places.map((p) => [p.id, p]));
  const ids = new Set(places.map((p) => p.id));
  if (Object.keys(inputs).some((id) => !ids.has(id)))
    throw new Error("UNKNOWN_WHEAT_PRA");
  const results: Record<string, AgroResult[]> = {};
  const territories = [
    "France",
    ...new Set(places.map((p) => p.region).sort()),
  ];
  const indicators = rules.map((rule) => {
    const data = places.map((p) =>
      (rule.version === COVERAGE_WHEAT_VERSION ? calculateCoverageWheat : calculateWheat)(p.id, inputs[p.id] ?? [], ...period, rule),
    );
    results[rule.id] = data;
    return {
      id: rule.id,
      unit: rule.unit,
      formula: rule.formula,
      threshold: rule.threshold,
      reference: rule.source,
      territories: territories.map((territory) => {
        const selected = data.filter(
            (r) =>
              territory === "France" ||
              placeById.get(r.territoryId)!.region === territory,
          ),
          valid = selected.filter((r) => (rule.version === COVERAGE_WHEAT_VERSION ? coverageWheatPublishable : isPublishable)(rule, r));
        const reasons: Record<string, number> = {};
        for (const r of selected)
          if (r.reason) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
        const max = [...valid].sort(
          (a, b) =>
            b.value! - a.value! || a.territoryId.localeCompare(b.territoryId),
        )[0];
        return {
          territory,
          coverage: {
            total: selected.length,
            evaluable: valid.length,
            complete: valid.filter(r => !r.quality || r.quality.state === "native_complete").length,
            ...(rule.version === COVERAGE_WHEAT_VERSION ? {observed_partial: selected.filter(r => r.quality?.state === "observed_partial").length,
            qualified_estimate: selected.filter(r => r.quality?.state === "qualified_estimate").length} : {}),
            partial: selected.filter((r) => r.status === "partial").length,
            unavailable: selected.filter((r) => r.status === "unavailable")
              .length,
            reasons,
          },
          positive_pra:
            rule.threshold !== null && rule.operator !== "gdd"
              ? valid.filter((r) => r.value! > 0).length
              : null,
          maximum: max
            ? {
                pra: max.territoryId,
                name: placeById.get(max.territoryId)!.name,
                value: max.value!,
                provenance: max.provenance,
                quality_flags: max.quality_flags,
                data_freshness: max.data_freshness,
                ...(max.quality ? {quality: max.quality} : {}),
              }
            : null,
        };
      }),
    };
  });
  const core = {
    version: rules[0]?.version ?? WHEAT_VERSION,
    source_version: source.version,
    nature: source.nature,
    run: source.run,
    period,
    qualification: rules[0]?.version === COVERAGE_WHEAT_VERSION ? coverageQualification : qualification,
    indicators,
  };
  return { summary: { ...core, identity: digest(core) }, results };
}

export function verifyWheatSummary(s: WheatSummary) {
  const { identity, ...core } = s;
  return identity === digest(core);
}
