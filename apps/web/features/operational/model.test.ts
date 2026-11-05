import {describe,it,expect} from 'vitest';
import {completeForecastCycle,cumulativeRain,weatherSelection,type WeatherRow,type WeatherCycle} from './model';
// Synthetic contract checks only; never served by the product.
function cycle():WeatherCycle {
  const run='2026-11-05T00:00:00+00:00',rows:WeatherRow[]=[];
  for(let pra=0;pra<12;pra++)for(let day=1;day<=7;day++)for(const variable of ['temperature','temperature_min','temperature_max','precipitation','humidity'] as const){
    const from=new Date(Date.parse(run)+day*86400000).toISOString(),to=new Date(Date.parse(run)+(day+1)*86400000).toISOString();
    rows.push({contract_version:'pra-weather-1',pra_id:`pra:${String(28000+pra)}`,variable,unit:variable==='precipitation'?'mm':variable==='humidity'?'%':'degC',value:1,status:'available',valid_date:from.slice(0,10),valid_from:from,valid_to:to,source_id:'ecmwf-open-data',model:'ifs-oper-0p25',nature:'forecast',model_run_at:run,lead_hours:(day+1)*24,rule_version:'pra-weather-1',grid_version:'synthetic-test',weights_sha256:'a'.repeat(64),spatial_coverage:1,temporal_coverage:1,quality_flags:['synthetic-test-only'],provenance_sha256:'b'.repeat(64),acquired_at:run,published_at:null,unavailable_reason:null,delayed:false,scientific_status:'exploratory'});
  }
  return {run,acquired_at:run,pra_count:12,rows,recent_estimate_status:'unavailable',attribution:'Synthetic test only'};
}
describe('operational source separation and atomic cycles',()=>{
  it('rejects relabelled forecasts, missing rows, duplicates and wrong leads',()=>{
    expect(completeForecastCycle(cycle())).toBe(true);
    for(const change of [{nature:'observation' as const},{lead_hours:24},{model_run_at:'2026-11-04T00:00:00Z'}]){
      const c=cycle();c.rows[0]={...c.rows[0],...change};expect(completeForecastCycle(c)).toBe(false);
    }
    const missing=cycle();missing.rows.pop();expect(completeForecastCycle(missing)).toBe(false);
    const duplicate=cycle();duplicate.rows[1]=duplicate.rows[0];expect(completeForecastCycle(duplicate)).toBe(false);
  });
  it('preserves NULL and never treats absent rain as zero',()=>{
    const c=cycle();expect(cumulativeRain(c,'pra:28000','2026-11-12')).toBe(7);
    const row=c.rows.find(r=>r.pra_id==='pra:28000'&&r.variable==='precipitation')!;
    row.status='partial';row.value=null;expect(cumulativeRain(c,'pra:28000','2026-11-12')).toBe(null);
    expect(weatherSelection(c,'2026-11-12','temperature')).toHaveLength(12);
  });
});
