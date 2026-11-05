export type WeatherVariable = 'temperature'|'temperature_min'|'temperature_max'|'precipitation'|'humidity';
export type WeatherRow = {
  contract_version: 'pra-weather-1'; pra_id:string;variable:WeatherVariable;unit:'degC'|'mm'|'%';value:number|null;
  status:'available'|'partial'|'unavailable';valid_date:string;valid_from:string;valid_to:string;
  source_id:string;model:string;nature:'observation'|'analysis'|'reanalysis'|'forecast';model_run_at:string|null;
  lead_hours:number|null;rule_version:string;grid_version:string;weights_sha256:string;spatial_coverage:number;
  temporal_coverage:number;quality_flags:string[];provenance_sha256:string;acquired_at:string;published_at:string|null;
  unavailable_reason:string|null;delayed:boolean|null;scientific_status:'exploratory';
};
export type WeatherCycle = {run:string|null;acquired_at:string|null;pra_count:number;rows:WeatherRow[];recent_estimate_status:string;attribution:string};
export const VARIABLES: {id:WeatherVariable;label:string;unit:string}[] = [
  {id:'temperature',label:'Température moyenne estimée',unit:'°C'},
  {id:'temperature_min',label:'Minimum échantillonné',unit:'°C'},
  {id:'temperature_max',label:'Maximum échantillonné',unit:'°C'},
  {id:'precipitation',label:'Précipitation quotidienne',unit:'mm'},
  {id:'humidity',label:'Humidité relative estimée',unit:'%'},
];
export function weatherSelection(cycle:WeatherCycle, date:string,variable:WeatherVariable) {
  return cycle.rows.filter(r=>r.valid_date===date&&r.variable===variable);
}
export function cumulativeRain(cycle:WeatherCycle,pra:string,end:string):number|null {
  const dates=[...new Set(cycle.rows.map(r=>r.valid_date))].sort().filter(d=>d<=end);
  const rows=dates.map(d=>cycle.rows.find(r=>r.pra_id===pra&&r.valid_date===d&&r.variable==='precipitation'));
  return rows.length&&rows.every(r=>r?.status==='available'&&r.value!==null)?rows.reduce((s,r)=>s+r!.value!,0):null;
}
export function completeForecastCycle(cycle:WeatherCycle):boolean {
  if(!cycle.run||!cycle.acquired_at||cycle.pra_count!==12||cycle.rows.length!==12*7*5)return false;
  const ids=new Set(cycle.rows.map(r=>r.pra_id));
  const keys=new Set(cycle.rows.map(r=>`${r.pra_id}/${r.valid_date}/${r.variable}`));
  const run=Date.parse(cycle.run);
  return Number.isFinite(run)&&ids.size===12&&keys.size===cycle.rows.length&&cycle.rows.every(r=>{
    const from=Date.parse(r.valid_from),to=Date.parse(r.valid_to),lead=(to-run)/3600000;
    return r.nature==='forecast'&&r.source_id==='ecmwf-open-data'&&r.model_run_at!==null&&Date.parse(r.model_run_at)===run
      &&r.valid_from.slice(0,10)===r.valid_date&&to-from===86400000&&lead===r.lead_hours
      &&[48,72,96,120,144,168,192].includes(lead)&&new Date(from).getUTCHours()===0
      &&(r.status==='available'?r.value!==null&&r.spatial_coverage>=0.9999&&r.temporal_coverage===1:r.value===null);
  });
}
