import {qualifyCoverage, type CoverageQuality} from "./policy";
import type {QualifiedDay} from "./calculate";
import type {WeatherRow} from "../operational/model";
export function forecastSupport(rows: WeatherRow[]): QualifiedDay["climate_support"] {
  if (!rows.length || rows.some(r => r.unit !== (r.variable === "humidity" ? "%" : r.variable === "precipitation" ? "mm" : "degC") || Date.parse(r.valid_from) !== Date.parse(r.valid_date + "T00:00:00Z") || Date.parse(r.valid_to) - Date.parse(r.valid_from) !== 86400000)) return undefined;
  const keys = rows.map(r => `${r.source_id}/${r.nature}/${r.model}/${r.model_run_at}/${r.grid_version}/${r.weights_sha256}/${r.rule_version}/${r.provenance.reference_version}/${r.unit}`);
  if (rows.some(r => !r.source_id || !r.provenance?.reference_version || !r.grid_version || !r.weights_sha256 || !r.model || !r.rule_version || (r.nature === "forecast" && (!r.model_run_at || !Number.isFinite(Date.parse(r.model_run_at)))))) return undefined;
  // Multi-variable methods need the same model, grid, weights, run and daily interval.
  const pairKeys = new Set(rows.map(r => `${r.source_id}/${r.model}/${r.model_run_at}/${r.grid_version}/${r.weights_sha256}/${r.valid_from}/${r.valid_to}`));
  if (pairKeys.size !== 1) return undefined;
  return {id: [...new Set(rows.map(r=>r.weights_sha256))].sort().join("|"), identity: [...new Set(keys)].sort().join("|"), fraction: Math.min(...rows.map(r => r.spatial_coverage)), temporal_complete: rows.every(r => r.temporal_coverage === 1), mask: "unknown", method: rows.map(r => r.rule_version).sort().join("|")};
}

export function weatherQualityKey(row: Pick<WeatherRow,"pra_id"|"valid_date"|"variable">) {
  return `${row.pra_id}/${row.valid_date}/${row.variable}`;
}

export interface WeatherQualityBundle {lookup: Record<string,string>; definitions: Record<string,CoverageQuality>}
export function weatherQualityBundle(rows: WeatherRow[]): WeatherQualityBundle {
 const lookup: Record<string,string>={},definitions: Record<string,CoverageQuality>={},ids=new Map<string,string>();
 for(const row of rows){
  const support=forecastSupport([row]);
  const q=qualifyCoverage(row.status==="unavailable"?null:row.value,row.variable==="humidity"?"specific":["temperature_min","temperature_max"].includes(row.variable)?"extreme_event":"mean_sum",{
   fraction:row.spatial_coverage,support_id:support?.id??null,mask:support?.mask??"unknown",represented_area_m2:null,
   expected_days:1,available_days:row.temporal_coverage===1?1:0,continuous:row.temporal_coverage===1,homogeneous:!!support,
   method:support?.method??"",estimate_certificate:null,reference_compatible:false,
  });
  const signature=JSON.stringify(q);let id=ids.get(signature);if(!id){id=`q${ids.size+1}`;ids.set(signature,id);definitions[id]=q;}
  lookup[weatherQualityKey(row)]=id;
 }
 return {lookup,definitions};
}
