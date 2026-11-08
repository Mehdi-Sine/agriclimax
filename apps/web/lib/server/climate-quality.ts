import "server-only";
import type {Rule} from "../../features/agroclimatic/catalogue";
import type {QualifiedDay} from "../../features/climate-quality/calculate";
import {observedSupportDay} from "./spatial-restitution";
export {forecastSupport} from "../../features/climate-quality/adapters";
export function applyObservedSupport(row: QualifiedDay, sourceCoverage: number | undefined, doc: Awaited<ReturnType<typeof observedSupportDay>>, variable: string): QualifiedDay {
  const p = doc.rows.find(p => p.pra_id === row.pra);
  if (row.complete || sourceCoverage === undefined || !doc.verified || !p?.support_id || !doc.geometries[p.support_id] || p.observed_value === null || p.temporal_coverage !== 1 || p.coverage <= 0 || Math.abs(sourceCoverage - p.coverage) > 1e-5) return row;
  return {...row, complete: true, values: {...row.values, [variable]: p.observed_value},
    climate_support: {id: p.support_id, identity: `${doc.identity}/${p.support_id}`, fraction: p.coverage, temporal_complete: true, mask: "native_valid_cells", method: p.rule_version},
    provenance: [...row.provenance, `${doc.identity}/${p.support_id}/${row.date}/${doc.data_sha256}`],
    quality_flags: [...row.quality_flags, ...p.quality_flags],
  };
}
export async function enrichHistoricalInputs<T extends QualifiedDay>(inputs: Record<string, T[]>, rule: Rule): Promise<Record<string, QualifiedDay[]>> {
  if (rule.variables.length !== 1 || rule.variables[0] === "humidity") return inputs;
  const dates = [...new Set(Object.values(inputs).flatMap(rows => rows.filter(r => !r.complete && (r.climate_support?.fraction ?? 0) > 0 && (r.climate_support?.fraction ?? 1) < .9999).map(r => r.date)))];
  const byDate = new Map<string, Awaited<ReturnType<typeof observedSupportDay>>>();
  for (const date of dates) byDate.set(date, await observedSupportDay(date, rule.variables[0]));
  return Object.fromEntries(Object.entries(inputs).map(([pra, rows]) => [pra, rows.map(row => byDate.has(row.date) ? applyObservedSupport(row, row.climate_support?.fraction, byDate.get(row.date)!, rule.variables[0]) : row)]));
}
