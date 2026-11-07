import type {ClimateContextRow} from '../national/model';
export function validatedAnomaly(row:ClimateContextRow):number|null{
 const compatible=row.current_status==='available'&&(row.current_coverage??0)>=.9999&&row.sample_years===row.expected_years&&row.expected_years===30&&row.reference_coverage===1;
 return compatible&&row.current_value!==null&&row.normal_1991_2020!==null&&row.anomaly!==null&&Number.isFinite(row.anomaly)?row.anomaly:null;
}
export interface HistoricalWatch {
 date:string;acquired_at:string|null;updated_at:string|null;freshness:string;identity:string;
 rows:ClimateContextRow[];source:string;rule_version:string;
}
