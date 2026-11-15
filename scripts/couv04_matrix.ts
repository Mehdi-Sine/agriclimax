/** Frozen real-source replay, no live coverage assertion and no external writes. */
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {strict as assert} from 'node:assert';
import {computeAgro03, AGRO03_RECIPES} from '../apps/web/features/multiproduction/agro03';
import {calculateQualified} from '../apps/web/features/climate-quality/calculate';
import {RULES} from '../apps/web/features/agroclimatic/catalogue';
import type {WeatherVariable} from '../apps/web/features/operational/model';
import {computeBatch, type ProductionDay} from '../apps/web/features/multiproduction/engine';
import {coveragePaint} from '../apps/web/features/cartography/coverage';
import {semanticPalette} from '../apps/web/features/cartography/registry';
import type {PraCollection} from '../apps/web/features/national/map';
import places from '../apps/web/data/operational/pra-watch-places.json';
import support from '../apps/web/data/operational/era5-spatial-support.json';
import restored from '../apps/web/data/operational/era5-restored-support.json';
const inputPath='docs/codex/CORE-01/evidence/frozen-inputs.json.gz';
const raw=readFileSync(inputPath);
const frozen=JSON.parse(gunzipSync(raw).toString()) as {inputs:Record<string,Record<string,ProductionDay[]>>};
const geometries={...support.geometries,...restored.geometries} as Record<string,PraCollection['features'][number]>;
const root='docs/codex/COUV-04/evidence'; mkdirSync(root,{recursive:true});
const ids=places.places.map(p=>p.id);assert.equal(new Set(ids).size,713);assert.equal(ids.filter(id=>/^pra:2[AB]/.test(id)).length,6);
const lines:string[]=['pra,indicator,source_scope,start,end,quality_state,fraction,target,reason,value,support_id'];
const summary:unknown[]=[];const visuals:unknown[]=[];let checks=0;
const began=performance.now();
const cases=[['reanalysis','2026-11-01','2026-11-01'],['reanalysis','2026-10-26','2026-11-01'],['reanalysis','2026-10-19','2026-11-01'],['reanalysis','2026-10-03','2026-11-01'],['forecast','2026-11-08','2026-11-08'],['forecast','2026-11-08','2026-11-14']];
for(const [nature,start,end] of cases){
 for(const source of nature==='forecast'?['selected','meteofrance-arome','meteofrance-arpege','ecmwf-open-data']:['era5-land']){
  const provider=(pra:string,variables:readonly string[])=>{
   const variable=variables.includes('humidity')?'temperature':variables[0];
   const direct=`${nature}/${start}/${end}/${variable}`;
   const key=frozen.inputs[direct]?direct:`${nature}/${nature==='reanalysis'?'2026-10-03':'2026-11-08'}/${end}/${variable}`;
   return (frozen.inputs[key]?.[pra]??[]).filter(r=>r.date>=start&&r.date<=end&&(source==='selected'||r.source===source));
  };
  const batch=computeAgro03(ids,[start,end],provider),baseline=computeBatch(ids,[start,end],provider);
  const lookup=new Map(batch.measurements.map(m=>[`${m.production}/${m.indicator}/${m.result.territoryId}`,m]));
  for(const old of baseline.measurements){const current=lookup.get(`${old.production}/${old.indicator}/${old.result.territoryId}`)!;
   assert.deepEqual({...current.result,rule_version:old.result.rule_version},old.result);checks++;}
  const unique=new Map(batch.measurements.map(m=>[`${m.indicator}/${m.result.territoryId}`,m]));
  const counts:Record<string,Record<string,number>>={};
  for(const m of unique.values()){
   const r=m.result, id=r.quality?.evidence.support_id??'',g=geometries[id];
   const mask=g&&g.id===r.territoryId?g.properties.support_id:undefined;
   const value=r.value??r.observed_value??null;
   const paint=coveragePaint({value,field:'value',quality:r.quality,geometrySupportId:mask});
   if(paint.target==='covered'){assert.equal(mask,id);assert(paint.fraction!<.9);}
   if(paint.target==='whole')assert(paint.fraction!>=.9);
   (counts[m.indicator]??={})[paint.target]=((counts[m.indicator]??{})[paint.target]??0)+1;
   lines.push([r.territoryId,m.indicator,source,start,end,r.quality?.state,paint.fraction,paint.target,paint.reason,paint.value,id].join(','));
   if(nature==='reanalysis'&&start===end&&['rain','temperature_mean','temperature_min'].includes(m.indicator))
    visuals.push({pra:r.territoryId,indicator:m.indicator,period:[start,end],value,quality:r.quality,paint,support_id:mask??null});
  }
  for(const recipe of AGRO03_RECIPES){assert.equal(Object.values(counts[recipe.id]).reduce((a,b)=>a+b,0),713);}
  // Raw weather maps also include Tmax and humidity, beyond the agro recipe registry.
  for(const variable of ['temperature','temperature_min','temperature_max','precipitation','humidity'] as WeatherVariable[]){
   const key=`raw:${variable}`;counts[key]={};
   const rule={...RULES.find(r=>r.id==='temperature_mean')!,id:key,variables:[variable],
    operator:variable==='precipitation'?'sum' as const:'mean' as const,
    unit:variable==='humidity'?'%':variable==='precipitation'?'mm':'°C',
    coverage_family:variable==='humidity'?'specific' as const:['temperature_min','temperature_max'].includes(variable)?'extreme_event' as const:'mean_sum' as const};
   for(const pra of ids){
    const r=calculateQualified(pra,provider(pra,[variable]),start,end,rule,null),id=r.quality?.evidence.support_id??'',g=geometries[id];
    const mask=g&&g.id===pra?g.properties.support_id:undefined;
    const paint=coveragePaint({value:r.value??r.observed_value??null,field:'value',quality:r.quality,geometrySupportId:mask});
    counts[key][paint.target]=(counts[key][paint.target]??0)+1;
    lines.push([pra,key,source,start,end,r.quality?.state,paint.fraction,paint.target,paint.reason,paint.value,id].join(','));
   }
   assert.equal(Object.values(counts[key]).reduce((a,b)=>a+b,0),713);
  }
  summary.push({nature,source_scope:source,period:[start,end],recipes:AGRO03_RECIPES.length,raw_variables:5,counts,
   caveat:nature==='forecast'?'Selected-source snapshot filtered by source; absent alternatives are untested, not proven unavailable in the model.':null});
 }
}
const csv=gzipSync(lines.join('\n')+'\n',{mtime:0} as import('node:zlib').ZlibOptions);
writeFileSync(`${root}/matrix.csv.gz`,csv);
writeFileSync(`${root}/visual-readings.json`,JSON.stringify(visuals));
writeFileSync(`${root}/matrix-summary.json`,JSON.stringify({input:{path:inputPath,sha256:createHash('sha256').update(raw).digest('hex')},
 scope:'Frozen operational inputs replay; presentation validation, not live availability or browser certification',
 rows:lines.length-1,pra:713,corsica:6,baseline_checks:checks,elapsed_ms:performance.now()-began,peak_rss_kib:process.resourceUsage().maxRSS,
 matrix_bytes:csv.length,network_calls:0,external_writes:0,palettes:['rain','temperature','temperature_min'].map(id=>semanticPalette(id,id==='rain'?'mm':'°C')),cases:summary},null,2));
console.log(JSON.stringify({rows:lines.length-1,checks,ms:performance.now()-began,bytes:csv.length}));
