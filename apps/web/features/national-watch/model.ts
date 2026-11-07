import {calculate,type InputDay} from '../agroclimatic/calculate';
import {RULES} from '../agroclimatic/catalogue';
import {cattleRule} from '../cattle/thi';
import type {WeatherRow} from '../operational/model';
export const WATCH_VERSION='national-watch-1.0.0';
export const PHENOMENA=[
 {id:'heat',rule:'hot',label:'Fortes températures prévues',threshold:25,unit:'°C',comparison:'Tmax > 25 °C'},
 {id:'frost',rule:'frost',label:'Gel météorologique attendu',threshold:0,unit:'°C',comparison:'Tmin < 0 °C'},
 {id:'rain',rule:'heavy_rain',label:'Pluie quotidienne importante',threshold:20,unit:'mm',comparison:'Pluie > 20 mm/j'},
 {id:'dry',rule:'dry_sequence',label:'Séquence sans pluie significative',threshold:1,unit:'jours',comparison:'Au moins 3 jours consécutifs < 1 mm/j, même source et run'},
 {id:'thi',rule:'thi_days',label:'Exposition thermique bovine',threshold:cattleRule.thresholds[0],unit:'THI',comparison:`THI synthétique > ${cattleRule.thresholds[0]}`},
] as const;
export type Phenomenon=typeof PHENOMENA[number]['id'];
export interface Place {id:string;name:string;region:string}
export interface WatchMetric {
 pra:string;phenomenon:Phenomenon;value:number|null;days:number|null;detected:boolean|null;
 state:'detected'|'no_threshold_crossing'|'insufficient'|'unavailable';
 sources:string[];provenance:string[];quality_flags:string[];rule_version:string;data_freshness:string[];
}
export interface WatchEvent {
 id:string;phenomenon:Phenomenon;region:string;start:string;end:string;value:number;unit:string;
 pra_ids:string[];evaluated:number;duration:number;text:string;intensity:number;production_ids:string[];
 provenance:string[];quality_flags:string[];rule_version:string;data_freshness:string[];
}
export interface ProductionPresence {id:string;label:string;pra_ids:string[];known_pra_ids:string[];source:string;year:number;limitation:string}
export type WatchEvidence=Pick<WatchMetric,'sources'|'provenance'|'quality_flags'|'rule_version'|'data_freshness'>;
export type WatchFact=Omit<WatchMetric,keyof WatchEvidence>&{evidence_id:string};
export function packMetrics(metrics:WatchMetric[]):{metrics:WatchFact[];evidence:Record<string,WatchEvidence>}{
 const evidence:Record<string,WatchEvidence>={},ids=new Map<string,string>();
 const facts=metrics.map(m=>{
  const {sources,provenance,quality_flags,rule_version,data_freshness,...fact}=m;
  const entry={sources,provenance,quality_flags,rule_version,data_freshness},signature=JSON.stringify(entry);
  let id=ids.get(signature);if(!id){id=`e${ids.size+1}`;ids.set(signature,id);evidence[id]=entry;}
  return {...fact,evidence_id:id};
 });return {metrics:facts,evidence};
}
export interface WatchSummary {
 version:string;identity:string;run:string;published_at:string|null;acquired_at:string;period:[string,string];
 source_nature:'forecast';metrics:WatchFact[];evidence:Record<string,WatchEvidence>;events:WatchEvent[];places:Place[];productions:ProductionPresence[];
 coverage:{phenomenon:Phenomenon;evaluated:number;affected:number;insufficient:number;unavailable:number}[];
 source_version:string;calculated_at:string;compute_ms:number;
}
function origin(r:WeatherRow){return `${r.source_id}/${r.model_run_at}/${r.nature}`;}
export function detectNational(rows:WeatherRow[],places:Place[],start:string,end:string):{metrics:WatchMetric[];events:WatchEvent[]} {
 const byPra=new Map<string,WeatherRow[]>(),keys=new Set<string>();
 for(const row of rows){
  if(row.valid_date<start||row.valid_date>end)continue;
  const key=`${row.pra_id}/${row.valid_date}/${row.variable}`;
  if(keys.has(key))throw new Error('DUPLICATE_WATCH_INPUT');keys.add(key);
  const list=byPra.get(row.pra_id)??[];list.push(row);byPra.set(row.pra_id,list);
 }
 const dates:string[]=[];for(let t=Date.parse(start);t<=Date.parse(end);t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));
 if(!dates.length||dates.length>7||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end)))throw new Error('INVALID_WATCH_PERIOD');
 const metrics:WatchMetric[]=[];
 for(const place of places)for(const phenomenon of PHENOMENA){
  const rule=RULES.find(r=>r.id===phenomenon.rule)!;
  const inputs=byPra.get(place.id)??[];
  const used=inputs.filter(r=>rule.variables.includes(r.variable));
  const days:InputDay[]=dates.map(date=>{
   const selected=used.filter(r=>r.valid_date===date),sources=new Set(selected.map(origin));
   return {pra:place.id,date,values:Object.fromEntries(selected.map(r=>[r.variable,r.value])),
    compatible:sources.size===1,complete:rule.variables.every(v=>selected.some(r=>r.variable===v&&r.status==='available'&&r.value!==null&&Number.isFinite(r.value)&&r.spatial_coverage>=.9999&&r.temporal_coverage===1)),
    source:selected[0]?.source_id??'missing',run:selected[0]?.model_run_at??null,nature:selected[0]?.nature??'missing',freshness:selected[0]?.data_freshness??'unknown',
    provenance:[...new Set(selected.map(r=>r.provenance_sha256))],quality_flags:[...new Set(selected.flatMap(r=>r.quality_flags))]};
  });
  // Existing calculator requires homogeneous inputs. Split on every calendar/source/run boundary.
  const segments:InputDay[][]=[];
  for(const day of days){const last=segments.at(-1)?.at(-1);if(!last||`${last.source}/${last.run}/${last.nature}`!==`${day.source}/${day.run}/${day.nature}`)segments.push([]);segments.at(-1)!.push(day);}
  const results=segments.map(segment=>calculate(place.id,segment,segment[0].date,segment.at(-1)!.date,rule,phenomenon.threshold));
  const valid=results.every(r=>r.value!==null&&r.status==='available');
  const values=results.flatMap(r=>r.series.flatMap(v=>v.value===null?[]:[v.value]));
  const value=!valid?null:phenomenon.id==='dry'?Math.max(...results.map(r=>r.longest??0)):phenomenon.id==='frost'?Math.min(...values):Math.max(...values);
  const count=valid?results.reduce((n,r)=>n+(phenomenon.id==='dry'?(r.longest??0):(r.value??0)),0):null;
  const detected=value===null?null:phenomenon.id==='dry'?value>=3:phenomenon.id==='frost'?value<0:value>phenomenon.threshold;
  metrics.push({pra:place.id,phenomenon:phenomenon.id,value,days:phenomenon.id==='dry'?value:count,detected,
   state:detected===null?(values.length?'insufficient':'unavailable'):detected?'detected':'no_threshold_crossing',
   sources:[...new Set(used.map(origin))].sort(),provenance:[...new Set(used.map(r=>r.provenance.checksum))].sort(),
   quality_flags:[...new Set([...used.flatMap(r=>r.quality_flags),...(segments.length>1?['source_run_boundaries_sequences_not_joined']:[]),...(!valid?['incomplete_or_incompatible_7day_window']:[]),...(used.some(r=>r.spatial_coverage>0&&r.spatial_coverage<.9999)?['partial_spatial_support_not_evaluated']:[])])].sort(),
   data_freshness:[...new Set(used.map(r=>r.data_freshness))].sort(),rule_version:`${WATCH_VERSION}/${rule.version}`});
 }
 const events:WatchEvent[]=[];
 for(const phenomenon of PHENOMENA)for(const region of [...new Set(places.map(p=>p.region))].sort()){
  const ids=new Set(places.filter(p=>p.region===region).map(p=>p.id));
  const all=metrics.filter(m=>m.phenomenon===phenomenon.id&&ids.has(m.pra)),affected=all.filter(m=>m.detected===true);
  if(!affected.length)continue;
  const value=(phenomenon.id==='frost'?Math.min:Math.max)(...affected.map(m=>m.value!));
  const intensity=phenomenon.id==='frost'?-value:phenomenon.id==='dry'?value/3:value/(phenomenon.threshold||1);
  const evaluated=all.filter(m=>m.detected!==null).length;
  events.push({id:`${phenomenon.id}:${region}:${start}:${end}`,phenomenon:phenomenon.id,region,start,end,value,unit:phenomenon.unit,
   pra_ids:affected.map(m=>m.pra).sort(),evaluated,duration:Math.max(...affected.map(m=>m.days??0)),intensity,production_ids:[],
   text:`${phenomenon.label} du ${start} au ${end} en ${region} : ${affected.length} PRA sur ${evaluated} évaluables franchissent le critère « ${phenomenon.comparison} ». ${phenomenon.id==='frost'?'Minimum': 'Maximum'} territorial : ${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(value)} ${phenomenon.unit}. Aucun dommage agricole évalué.`,
   provenance:[...new Set(affected.flatMap(m=>m.provenance))].sort(),quality_flags:[...new Set(affected.flatMap(m=>m.quality_flags))].sort(),
   rule_version:WATCH_VERSION,data_freshness:[...new Set(affected.flatMap(m=>m.data_freshness))].sort()});
 }
 // Editorial ordering, not a risk score. Ties have stable territorial IDs.
 events.sort((a,b)=>b.intensity-a.intensity||b.duration-a.duration||b.pra_ids.length-a.pra_ids.length||a.id.localeCompare(b.id));
 return {metrics,events};
}
export function watchFreshness(summary:Pick<WatchSummary,'run'|'acquired_at'|'period'>,now:number){
 return {stale:now-Date.parse(summary.run)>36*3600000,expired:summary.period[1]<new Date(now).toISOString().slice(0,10)};
}
