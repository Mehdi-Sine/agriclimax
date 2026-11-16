import 'server-only';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Rule} from '../../features/agroclimatic/catalogue';
import type {AgroResult} from '../../features/agroclimatic/calculate';
import type {WeatherRow} from '../../features/operational/model';
import type {PraCollection} from '../../features/national/map';
import {calendarDays} from '../../features/national/daily-availability';
import {FORECAST_MASK_VERSION} from '../../features/cartography/forecast-support';
import {record} from './weather-archive-codec';
import {forecastMaskObject} from './weather-archives';

export const canonical = (value:unknown):string => JSON.stringify(value, (_key,v:unknown) =>
  record(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
const hash=(raw:Uint8Array)=>createHash('sha256').update(raw).digest('hex');
type QualifiedRecord={archive_sha256:string;rule:Rule;start:string;end:string;pra_id:string;
  model:string;run:string;inputs:string[];support_id:string;cellset_sha256:string;fraction:number;
  reference_sha256:string;result:AgroResult;geometry:PraCollection['features'][number]['geometry']|null};
async function unpack(path:string,sha:string,budget:{packed:number;decoded:number},bytes?:number):Promise<unknown>{
  if(!/^[a-f0-9]{64}$/.test(sha))throw Error('QUALIFIED_SHA');
  const raw=await forecastMaskObject(path,1024**2);
  if(!raw||raw.length>1024**2||(bytes!==undefined&&raw.length!==bytes)||hash(raw)!==sha)throw Error('QUALIFIED_INTEGRITY');
  budget.packed+=raw.length;
  if(budget.packed>2*1024**2)throw Error('QUALIFIED_TRANSFER_BUDGET');
  const decoded=gunzipSync(raw,{maxOutputLength:16*1024**2-budget.decoded});
  budget.decoded+=decoded.length;
  return JSON.parse(decoded.toString());
}
/** Read only the exact recipe shard. Never infer compatibility from a fraction.
 * The producer certifies common cells/geometry; the immutable pin authenticates
 * that certificate, including the prequalified numeric result. No grid is read.
 */
export async function forecastQualified(rows:WeatherRow[],archive:string,rule:Rule,start:string,end:string,threshold:number|null){
  const results=new Map<string,AgroResult>(),collection:PraCollection={type:'FeatureCollection',features:[]};
  if(process.env.COUV05_RENDER_ENABLED!=='true')return {results,collection};
  try{
    const budget={packed:0,decoded:0};
    const pin=process.env.COUV05_INDEX_SHA256;
    if(!pin)return {results,collection};
    const index=await unpack(`forecast-masks/indexes/${pin}.json.gz`,pin,budget);
    if(!record(index)||index.version!==FORECAST_MASK_VERSION||index.archive_sha256!==archive||!Array.isArray(index.qualified_entries)||index.qualified_entries.length>512)return {results,collection};
    const entries=index.qualified_entries.filter(e=>record(e)&&canonical(e.rule)===canonical(rule)&&e.start===start&&e.end===end&&rows.length>0&&rows.some(r=>r.model===e.model&&Date.parse(r.model_run_at??'')===Date.parse(String(e.run))));
    if(!entries.length||entries.length>5||threshold!==rule.threshold)return {results,collection};
    for(const entry of entries){
    if(!record(entry)||typeof entry.sha256!=='string'||entry.path!==`forecast-masks/blobs/${entry.sha256}.json.gz`||typeof entry.bytes!=='number')throw Error('QUALIFIED_ENTRY');
    const document=await unpack(String(entry.path),entry.sha256,budget,entry.bytes);
    if(!record(document)||document.version!=='couv05e-qualified-1'||!Array.isArray(document.rows)||document.rows.length>1185)throw Error('QUALIFIED_SCHEMA');
    const reference=hash(readFileSync(join(process.cwd(),'../../config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json')));
    const seen=new Set<string>(),days=calendarDays(start,end);
    for(const unknown of document.rows){
      if(!record(unknown)||typeof unknown.pra_id!=='string'||seen.has(unknown.pra_id))throw Error('QUALIFIED_DUPLICATE');
      seen.add(unknown.pra_id);
      const r=unknown as unknown as QualifiedRecord;
      if(r.archive_sha256!==archive||canonical(r.rule)!==canonical(rule)||r.start!==start||r.end!==end||r.reference_sha256!==reference||!Array.isArray(r.inputs)||!Number.isFinite(r.fraction)||r.fraction<=0||r.fraction>1||! /^[a-f0-9]{64}$/.test(r.cellset_sha256)||! /^[a-f0-9]{64}$/.test(r.support_id))throw Error('QUALIFIED_IDENTITY');
      const selected=rows.filter(row=>row.pra_id===r.pra_id);
      const keys=selected.map(row=>`${row.valid_date}/${row.variable}`);
      const required=days.flatMap(day=>rule.variables.map(v=>`${day}/${v}`));
      if(keys.length!==required.length||new Set(keys).size!==required.length||keys.some(k=>!required.includes(k)))continue;
      const sources=new Map(r.inputs.map(input=>{const i:unknown=JSON.parse(input);if(!Array.isArray(i)||i.length!==4||!i.every(v=>typeof v==='string'))throw Error('QUALIFIED_INPUT');return [`${i[0]}/${i[1]}`,i[2]];}));
      if(sources.size!==required.length||selected.some(row=>row.model!==r.model||Date.parse(row.model_run_at??'')!==Date.parse(r.run)||!Number.isFinite(Date.parse(r.run))||row.provenance_sha256!==sources.get(`${row.valid_date}/${row.variable}`)))continue;
      const result=r.result;
      if(!record(result)||result.territoryId!==r.pra_id||result.rule_version!==rule.version||result.parameters?.threshold!==threshold||result.support_id!==r.support_id||result.quality?.evidence.support_id!==r.support_id||result.quality.evidence.fraction!==r.fraction||!result.quality.indicator_eligible||!Number.isFinite(result.value??result.observed_value))throw Error('QUALIFIED_RESULT');
      if(r.fraction<.9){
        if(!record(r.geometry)||!['Polygon','MultiPolygon'].includes(r.geometry.type))throw Error('QUALIFIED_GEOMETRY');
        collection.features.push({type:'Feature',id:r.pra_id,properties:{code:r.pra_id.slice(4),name:r.pra_id,department_name:'',region_name:'',support_id:r.support_id},geometry:r.geometry});
      }
      if(results.has(r.pra_id))throw Error('QUALIFIED_AMBIGUOUS');
      results.set(r.pra_id,result);
    }
    }
    return {results,collection};
  }catch(error){return {results:new Map<string,AgroResult>(),collection:{type:'FeatureCollection' as const,features:[]},reason:error instanceof Error&&/^QUALIFIED_[A-Z_]+$/.test(error.message)?error.message:'QUALIFIED_UNAVAILABLE'};}
}
