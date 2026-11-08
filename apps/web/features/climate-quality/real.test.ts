import {it,expect,vi} from "vitest";
import {mkdir,writeFile} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import {createHash} from "node:crypto";
vi.mock("server-only",()=>({}));
import {archiveCatalogue,archivedEra5Day,nationalWeatherDocument,type ArchivedDaily} from "../../lib/server/weather-archives";
import {historicalWheatInputs,forecastWheatInputs,computeWheatBatch} from "../../lib/server/wheat";
import {enrichHistoricalInputs} from "../../lib/server/climate-quality";
import {wheatRules} from "../wheat/qualified";
import {coverageWheatRules} from "../wheat/coverage";
import {calendarDays,trailingStart} from "../national/daily-availability";
import {detectNational,detectQualifiedNational,packMetrics} from "../national-watch/model";
import {journalMapData} from "../journal/ui/map-data";
import type {WatchSummary} from "../national-watch/model";
import {weatherQualityBundle,weatherQualityKey} from "./adapters";
import {unifiedData} from "../../lib/server/unified";
import {agroclimaticData} from "../../lib/server/agroclimatic";
import geography from "../../data/operational/pra-watch-places.json";
import type {WheatDay} from "../wheat/qualified";
import type {AgroResult} from "../agroclimatic/calculate";
it.skipIf(process.env.CORE01_REAL!=="1")("CORE-01 real 713 PRA read-only acceptance",async()=>{
 const out="../../docs/codex/CORE-01/evidence";await mkdir(out,{recursive:true});
 const began=performance.now(),rss=process.memoryUsage().rss;
 const catalogue=await archiveCatalogue();expect(catalogue).not.toBeNull();
 const dates=[...new Set(catalogue!.era5.flatMap(e=>e.dates))].sort(),latest=dates.at(-1)!;
 const archived:ArchivedDaily[]=[];
 for(const date of dates.filter(d=>d>=trailingStart(latest,30))) archived.push(...await archivedEra5Day(date)??[]);
 const doc=await nationalWeatherDocument();expect(doc).not.toBeNull();
 const raw=doc!.selected_indices.map(i=>doc!.rows[i]);
 const forecastStart=trailingStart(doc!.run.slice(0,10),0),forecastEnd=trailingStart(doc!.run.slice(0,10),-6);
 const matrix:unknown[]=[],counts:unknown[]=[],frozen:unknown[]=[],regressions:unknown[]=[];
 const frozenInputs:Record<string,Record<string,WheatDay[]>>={};
 const classify=(r:AgroResult)=>r.quality?.state??(r.value!==null?'native_complete':r.status==='partial'?'unavailable':'unavailable');
 const plans=[...[1,7,30].map(n=>({period:[trailingStart(latest,n),latest] as [string,string],nature:'reanalysis' as const,run:null})),...[[forecastStart,forecastStart],[forecastStart,forecastEnd]].map(p=>({period:p as [string,string],nature:'forecast' as const,run:doc!.run}))];
 for(const plan of plans){
  const window=calendarDays(...plan.period),inputCache=new Map<string,Record<string,WheatDay[]>>(),oldCache=new Map<string,Record<string,WheatDay[]>>();
  for(const rule of wheatRules){const key=rule.variables.join();if(inputCache.has(key))continue;
   const base=plan.nature==='forecast'?forecastWheatInputs(doc!,rule,window):historicalWheatInputs(archived.filter(r=>window.includes(r.valid_date)),rule);
   oldCache.set(key,base);
   inputCache.set(key,(plan.nature==='forecast'?base:await enrichHistoricalInputs(base,rule)) as Record<string,WheatDay[]>);
  }
  for(const [variable,inputs] of inputCache) frozenInputs[`${plan.nature}/${plan.period.join("/")}/${variable}`]=inputs;
  const source={version:plan.nature==='forecast'?doc!.archive_sha256:createHash('sha256').update(JSON.stringify(catalogue!.era5)).digest('hex'),nature:plan.nature,run:plan.run};
  const before=computeWheatBatch(plan.period,source,r=>oldCache.get(r.variables.join())!);
  const t=performance.now();
  const after=computeWheatBatch(plan.period,source,r=>inputCache.get(r.variables.join())!,coverageWheatRules),ms=performance.now()-t;
  for(const rule of coverageWheatRules){
   const results=after.results[rule.id],old=before.results[rule.id];expect(results).toHaveLength(713);
   const states:Record<string,number>={};
   for(let i=0;i<results.length;i++){
    const r=results[i],state=classify(r);states[state]=(states[state]??0)+1;
    if(old[i].value!==null&&r.value!==old[i].value)regressions.push({plan,indicator:rule.id,pra:r.territoryId,before:old[i].value,after:r.value});
    matrix.push({usage:'wheat',indicator:rule.id,...plan,pra:r.territoryId,region:geography.places.find(p=>p.id===r.territoryId)!.region,before:old[i].value,after:r.value,observed_value:r.observed_value,state,spatial_coverage:r.spatial_coverage,temporal_coverage:r.temporal_coverage,reason:r.reason,category:r.spatial_coverage===0&&r.observedDays===0?"absent":state==="native_complete"?"native_complete":state==="observed_partial"?"observed_partial":state==="qualified_estimate"?"qualified_estimate":"non_evaluable",journal_eligible:r.quality?.journal_eligible});
    frozen.push({pra:r.territoryId,rule_id:rule.id,period:plan.period,input_key:`${plan.nature}/${plan.period.join("/")}/${rule.variables.join()}`,value:r.value,observed_value:r.observed_value,state:r.quality?.state});
   }
   counts.push({usage:'wheat',indicator:rule.id,...plan,before:before.summary.indicators.find(i=>i.id===rule.id)!.territories[0].coverage,after:states,compute_ms:ms});
  }
 }
 expect(regressions).toEqual([]);
 // Exercise actual reading chains, not a reconstruction of UI counts.
 const integration=[];
 for(const n of [1,7])for(const indicator of ['temperature','hot','rain']){
  const start=trailingStart(latest,n);
  const before=await unifiedData(new URLSearchParams({start,end:latest,indicator,rule_version:'agroclimatic-1.2.0'}));
  const after=await unifiedData(new URLSearchParams({start,end:latest,indicator}));
  expect(after.data).toHaveLength(713);
  for(const row of after.data){if(row.quality?.state==='observed_partial'){expect(row.observed_series).toHaveLength(n);expect(row.observed_series!.every(day=>day.value!==null)).toBe(true);}if(row.quality?.state==='native_complete')expect(row.observed_series).toBeUndefined();}
  integration.push({usage:'climate',indicator,period:[start,latest],before_bytes:Buffer.byteLength(JSON.stringify(before)),after_bytes:Buffer.byteLength(JSON.stringify(after)),before:before.data.map(r=>({pra:r.territoryId,value:r.value,observed:r.observed_value})),after:after.data.map(r=>({pra:r.territoryId,value:r.value,observed:r.observed_value,quality:r.quality}))});
 }
 const agro=await agroclimaticData(new URLSearchParams({indicator:'temperature_mean',start:latest,end:latest}));
 expect(agro.data).toHaveLength(713);
 integration.push({usage:'agro',indicator:'temperature_mean',period:[latest,latest],after:agro.data.map(r=>({pra:r.territoryId,value:r.value,observed:r.observed_value,quality:r.quality}))});
 const agroSeven=await agroclimaticData(new URLSearchParams({indicator:'temperature_mean',start:trailingStart(latest,7),end:latest}));
 expect(agroSeven.data.filter(r=>r.quality?.state==='native_complete')).toHaveLength(645);
 expect(agroSeven.data.filter(r=>r.quality?.state==='observed_partial')).toHaveLength(67);
 integration.push({usage:'agro',indicator:'temperature_mean',period:[trailingStart(latest,7),latest],after:agroSeven.data.map(r=>({pra:r.territoryId,value:r.value,observed:r.observed_value,quality:r.quality}))});
 const forecastRows=raw.filter(r=>r.valid_date>=forecastStart&&r.valid_date<=forecastEnd),forecastQuality=weatherQualityBundle(forecastRows);
 const forecastExplorer=forecastRows.map(r=>({pra:r.pra_id,date:r.valid_date,variable:r.variable,value:r.value,status:r.status,quality_id:forecastQuality.lookup[weatherQualityKey(r)]}));
 await writeFile(`${out}/forecast-explorer.json.gz`,gzipSync(JSON.stringify({rows:forecastExplorer,quality:forecastQuality.definitions})));
 const oldWatch=detectNational(raw,geography.places,forecastStart,forecastEnd),watch=detectQualifiedNational(raw,geography.places,forecastStart,forecastEnd);
 for(let i=0;i<oldWatch.metrics.length;i++) if(oldWatch.metrics[i].detected!==null){expect(watch.metrics[i].value).toBe(oldWatch.metrics[i].value);expect(watch.metrics[i].detected).toBe(oldWatch.metrics[i].detected);}
 const packed=packMetrics(watch.metrics);
 const summary={...packed,places:geography.places,run:doc!.run,period:[forecastStart,forecastEnd],identity:doc!.archive_sha256,source_version:doc!.archive_sha256,version:'national-watch-1.1.0'} as WatchSummary;
 const dailyWatch={before:detectNational(raw,geography.places,forecastStart,forecastStart),after:detectQualifiedNational(raw,geography.places,forecastStart,forecastStart)};
 const maps=['heat','frost','rain','dry','thi'].map(p=>journalMapData(summary,p));
 for(const map of maps){expect(map.rows).toHaveLength(713);for(const r of map.rows){const metric=watch.metrics.find(m=>m.pra===r.id&&m.phenomenon===map.phenomenon)!;expect(r.value).toBe(metric.value??(metric.quality?.state==='observed_partial'?metric.observed_value:null)??null);}}
 await writeFile(`${out}/matrix.json.gz`,gzipSync(JSON.stringify(matrix)));
 await writeFile(`${out}/frozen-inputs.json.gz`,gzipSync(JSON.stringify({rules:coverageWheatRules,inputs:frozenInputs,cases:frozen})));
 await writeFile(`${out}/integration.json.gz`,gzipSync(JSON.stringify(integration)));
 await writeFile(`${out}/watch.json.gz`,gzipSync(JSON.stringify({before:oldWatch,after:watch,maps,daily:dailyWatch})));
 await writeFile(`${out}/validation.json`,JSON.stringify({executed_at:new Date().toISOString(),archive_dates:dates,forecast_run:doc!.run,forecast_sha256:doc!.archive_sha256,archive_entries:catalogue!.era5,regressions,counts,resources:{total_ms:performance.now()-began,rss_initial:rss,rss_final:process.memoryUsage().rss,peak_rss_bytes:process.resourceUsage().maxRSS*1024,watch_bytes:Buffer.byteLength(JSON.stringify(packed)),matrix_rows:matrix.length}},null,2));
},300000);
