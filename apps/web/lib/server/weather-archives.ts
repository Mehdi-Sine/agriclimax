import 'server-only';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../../../contracts/jsonschema/pra-weather-1.schema.json';
import identities from '../../data/operational/pra-identities.json';
import {completeForecastCycle,type WeatherCycle,type WeatherRow} from '../../features/operational/model';
import {NATIONAL} from '../../features/national/model';
import {isCalendarDate} from '../../features/national/daily-availability';
import {record,unpackWeatherArchive,type JsonRecord} from './weather-archive-codec';

const BUCKET='pra-climate-archives';
const ajv=new Ajv2020({strict:false});addFormats(ajv);
const validRow=ajv.compile<WeatherRow>(schema);
export type ArchiveEntry={path:string;sha256:string;bytes:number;dates:string[];run_date?:string;run_at?:string;method_version?:string;pra_count?:number};
export type ArchiveCatalogue={version:'pra-archive-catalogue-1';weather:ArchiveEntry[];era5:ArchiveEntry[];supports?:ArchiveEntry[]};
export type NationalWeatherDocument=JsonRecord&{archive_sha256:string;rows:WeatherRow[];selected_indices:number[];run:string;acquired_at:string;pra_count:713;attribution:string;recent_estimate_status:string};
let catalogueCache:{expires:number;value:Promise<ArchiveCatalogue|null>}|undefined;
let cycleCache:{sha:string;value:Promise<NationalWeatherDocument>}|undefined;

async function storage(path:string,limit:number):Promise<Uint8Array|null>{
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!base||!key)return null;
  const url=new URL(base);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!/^[-a-zA-Z0-9_/.]+$/.test(path)||path.includes('..'))throw new Error('ARCHIVE_CONFIGURATION');
  url.pathname=`/storage/v1/object/${BUCKET}/${path}`;
  const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:key}});
  if(!response.ok){
    if(response.status===404)return null;
    if(response.status===400){const body:unknown=await response.json();if(record(body)&&String(body.statusCode)==='404')return null;}
    throw new Error('ARCHIVE_UNAVAILABLE');
  }
  const length=Number(response.headers.get('content-length'));
  if(length>limit)throw new Error('ARCHIVE_BUDGET');
  const reader=response.body?.getReader();if(!reader)throw new Error('ARCHIVE_EMPTY');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('ARCHIVE_BUDGET');}chunks.push(value);}
  return Buffer.concat(chunks,size);
}
function entry(value:unknown):value is ArchiveEntry{
  return record(value)&&typeof value.path==='string'&&/^(weather|era5|support)\/[a-f0-9]{64}\.json\.gz$/.test(value.path)&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)&&value.path.includes(value.sha256)&&typeof value.bytes==='number'&&value.bytes>0&&value.bytes<=8*1024**2&&Array.isArray(value.dates)&&value.dates.length<=31&&value.dates.every(d=>typeof d==='string'&&isCalendarDate(d));
}
export function archiveCatalogue():Promise<ArchiveCatalogue|null>{
  if(catalogueCache&&catalogueCache.expires>Date.now())return catalogueCache.value;
  const value=(async()=>{
    const raw=await storage('catalogue.json',1024*1024);if(!raw)return null;
    const parsed:unknown=JSON.parse(Buffer.from(raw).toString());
    if(!record(parsed)||parsed.version!=='pra-archive-catalogue-1'||!Array.isArray(parsed.weather)||!Array.isArray(parsed.era5)||parsed.weather.length>2000||parsed.era5.length>2000||!parsed.weather.every(entry)||!parsed.era5.every(entry)||(parsed.supports!==undefined&&(!Array.isArray(parsed.supports)||parsed.supports.length>2000||!parsed.supports.every(entry))))throw new Error('ARCHIVE_CATALOGUE');
    return parsed as ArchiveCatalogue;
  })();
  catalogueCache={expires:Date.now()+15*60000,value};
  void value.catch(()=>{if(catalogueCache?.value===value)catalogueCache=undefined;});return value;
}
type CurrentManifest={version:'pra-current-1';weather:ArchiveEntry[];era5:ArchiveEntry[];era5_dates:string[];supports?:ArchiveEntry[];land_masks?:ArchiveEntry|null};
let currentCache:{expires:number;value:Promise<CurrentManifest|null>}|undefined;
export function currentManifest():Promise<CurrentManifest|null>{
 if(currentCache&&currentCache.expires>Date.now())return currentCache.value;
 const value=(async()=>{const raw=await storage('current.json',64*1024);if(!raw)return null;const d:unknown=JSON.parse(Buffer.from(raw).toString());if(!record(d)||d.version!=='pra-current-1'||!Array.isArray(d.weather)||d.weather.length>1||!d.weather.every(entry)||!Array.isArray(d.era5)||d.era5.length>1||!d.era5.every(entry)||!Array.isArray(d.era5_dates)||d.era5_dates.length>2000||!d.era5_dates.every(v=>typeof v==='string'&&isCalendarDate(v))||(d.supports!==undefined&&(!Array.isArray(d.supports)||d.supports.length>1||!d.supports.every(entry))))throw new Error('CURRENT_MANIFEST');return d as CurrentManifest;})();
 currentCache={expires:Date.now()+60000,value};void value.catch(()=>{if(currentCache?.value===value)currentCache=undefined;});return value;
}
export async function archiveBlob(e:ArchiveEntry):Promise<Uint8Array>{const raw=await storage(e.path,8*1024**2);if(!raw||raw.length!==e.bytes||createHash('sha256').update(raw).digest('hex')!==e.sha256)throw new Error('ARCHIVE_CHECKSUM');return raw;}
export async function nationalWeatherDocument(requestedRun?:string):Promise<NationalWeatherDocument|null>{
  const current=requestedRun?null:await currentManifest();
  const catalogue=current??await archiveCatalogue();
  const latest=catalogue?.weather.filter(e=>e.method_version==='pra-national-weather-daily-1'&&(!requestedRun||(requestedRun.includes('T')?Date.parse(e.run_at??e.run_date+'T00:00:00Z')===Date.parse(requestedRun):e.run_date===requestedRun))&&typeof e.run_date==='string'&&isCalendarDate(e.run_date)).sort((a,b)=>(b.run_at??b.run_date!).localeCompare(a.run_at??a.run_date!))[0];
  if(!latest)return null;
  if(cycleCache?.sha===latest.sha256)return cycleCache.value;
  const value=(async()=>{
    const d=unpackWeatherArchive(await archiveBlob(latest),latest.sha256);
    const rows=d.rows,selected=d.selected_indices;
    if(d.scope!=='national'||d.pra_count!==713||typeof d.run!=='string'||typeof d.acquired_at!=='string'||typeof d.attribution!=='string'||typeof d.recent_estimate_status!=='string'||!Array.isArray(rows)||rows.length!==49910||!rows.every((r):r is WeatherRow=>validRow(r))||!Array.isArray(selected)||!selected.every((i):i is number=>typeof i==='number'&&Number.isInteger(i)&&i>=0&&i<rows.length))throw new Error('NATIONAL_WEATHER_CONTRACT');
    const expected=new Set(identities.ids);
    if(!rows.every(r=>expected.has(r.pra_id))||new Set(rows.map(r=>r.pra_id)).size!==713)throw new Error('NATIONAL_WEATHER_IDENTITIES');
    const c:WeatherCycle={scope:'national',run:d.run,acquired_at:d.acquired_at,pra_count:713,rows:selected.map(i=>rows[i]),recent_estimate_status:d.recent_estimate_status,attribution:d.attribution};
    if(!completeForecastCycle(c))throw new Error('NATIONAL_WEATHER_SELECTION');
    return {...d,archive_sha256:latest.sha256,rows,selected_indices:selected,run:d.run,acquired_at:d.acquired_at,pra_count:713,attribution:d.attribution,recent_estimate_status:d.recent_estimate_status} as NationalWeatherDocument;
  })();
  cycleCache={sha:latest.sha256,value};void value.catch(()=>{if(cycleCache?.value===value)cycleCache=undefined;});return value;
}
export type ArchivedDaily={pra_id:string;valid_date:string;temperature:number|null;temperature_min:number|null;temperature_max:number|null;precipitation:number|null;coverage:number[];valid_counts:number[];expected_cells:number;status:'available'|'partial'|'unavailable';quality_flags:string[];batch_key:string;computed_at:string;identity:JsonRecord};
const exactCache=new Map<string,Promise<JsonRecord[]>>();
export function postgresReal(value:number):number{
  const real=Math.fround(value);
  for(let precision=1;precision<=9;precision++){const candidate=Number(real.toPrecision(precision));if(Math.fround(candidate)===real)return candidate;}
  return real;
}
async function exactRecords(e:ArchiveEntry):Promise<JsonRecord[]>{
  const hit=exactCache.get(e.sha256);if(hit)return hit;
  const promise=(async()=>{
    const parsed:unknown=JSON.parse(gunzipSync(await archiveBlob(e),{maxOutputLength:32*1024**2}).toString());
    if(!record(parsed)||parsed.archive_version!=='pra-exact-bytes-1'||!Array.isArray(parsed.records))throw new Error('EXACT_ARCHIVE_CONTRACT');
    const outputs:JsonRecord[]=[];
    for(const r of parsed.records){
      if(!record(r)||typeof r.path!=='string'||!/^batches\/[a-f0-9]{64}\/output\.json$/.test(r.path)||typeof r.content!=='string'||typeof r.sha256!=='string'||createHash('sha256').update(r.content).digest('hex')!==r.sha256)throw new Error('EXACT_ARCHIVE_CHECKSUM');
      const output:unknown=JSON.parse(r.content);
      if(!record(output)||!Array.isArray(output.daily)||!record(output.identity)||!record(output.identity.dataset)||output.identity.dataset.source_id!=='era5-land'||output.identity.dataset.dataset_version!==NATIONAL.dataset||output.identity.method!=='pra-native-1'||r.path!==`batches/${output.batch_key}/output.json`)throw new Error('EXACT_ARCHIVE_ENVELOPE');
      outputs.push(output);
    }
    return outputs;
  })();
  if(exactCache.size>=3)exactCache.delete(exactCache.keys().next().value!);
  exactCache.set(e.sha256,promise);void promise.catch(()=>{if(exactCache.get(e.sha256)===promise)exactCache.delete(e.sha256);});return promise;
}
export async function archivedEra5Day(date:string):Promise<ArchivedDaily[]|null>{
  if(!isCalendarDate(date))throw new Error('ARCHIVE_DATE');
  const current=await currentManifest();
  const e=current?.era5.find(e=>e.dates.includes(date))??(await archiveCatalogue())?.era5.find(e=>e.dates.includes(date));if(!e)return null;
  const rows:ArchivedDaily[]=[];
  for(const output of await exactRecords(e)){
    for(const row of output.daily as unknown[])if(record(row)&&row.valid_date===date){
      const copy:JsonRecord={...row,batch_key:output.batch_key,identity:output.identity,computed_at:output.computed_at};
      for(const field of ['temperature','temperature_min','temperature_max','precipitation']){
        if(copy[field]!==null&&(typeof copy[field]!=='number'||!Number.isFinite(copy[field])))throw new Error('ARCHIVE_VALUE');
        if(typeof copy[field]==='number')copy[field]=postgresReal(copy[field]);
      }
      if(!Array.isArray(copy.coverage)||copy.coverage.length!==4||!copy.coverage.every(v=>typeof v==='number'&&v>=0&&v<=1.0001)||!Array.isArray(copy.valid_counts)||copy.valid_counts.length!==4||!copy.valid_counts.every(v=>Number.isInteger(v)&&v>=0)||typeof copy.expected_cells!=='number'||!['available','partial','unavailable'].includes(String(copy.status))||!Array.isArray(copy.quality_flags)||!copy.quality_flags.every(v=>typeof v==='string')||typeof copy.batch_key!=='string'||typeof copy.computed_at!=='string'||typeof copy.pra_id!=='string')throw new Error('ARCHIVE_SUPPORT');
      copy.coverage=copy.coverage.map(v=>postgresReal(v));
      rows.push(copy as ArchivedDaily);
    }
  }
  if(rows.length!==713||new Set(rows.map(r=>r.pra_id)).size!==713||!rows.every(r=>identities.ids.includes(r.pra_id)))throw new Error('EXACT_ARCHIVE_IDENTITIES');
  return rows;
}

let landCache:{sha:string;value:Promise<Record<string,Record<string,{native_cells:number;physical_land_mask_available:boolean;source_land_fraction:number;mask_sha256:string}>>>}|undefined;
export async function nationalLandMasks(){
 const current=await currentManifest(),e=current?.land_masks;if(!e)return null;
 if(!entry(e))throw new Error('LAND_MASK_POINTER');
 if(landCache?.sha===e.sha256)return landCache.value;
 const value=(async()=>{const raw:unknown=JSON.parse(gunzipSync(await archiveBlob(e),{maxOutputLength:4*1024**2}).toString());if(!record(raw)||raw.rule_version!=='pra-official-model-land-fraction-1'||!record(raw.sources))throw new Error('LAND_MASK_CONTRACT');
 const result:Record<string,Record<string,{native_cells:number;physical_land_mask_available:boolean;source_land_fraction:number;mask_sha256:string}>>={};
 for(const name of ['arome','arpege']){const source=raw.sources[name];if(!record(source)||!record(source.pra)||Object.keys(source.pra).length!==713)throw new Error('LAND_MASK_IDENTITIES');result[name]={};for(const [pra,q] of Object.entries(source.pra)){if(!identities.ids.includes(pra)||!record(q)||typeof q.native_cells!=='number'||q.physical_land_mask_available!==true||typeof q.source_land_fraction!=='number'||q.source_land_fraction<0||q.source_land_fraction>1.0001||typeof q.mask_sha256!=='string'||!/^[a-f0-9]{64}$/.test(q.mask_sha256))throw new Error('LAND_MASK_VALUE');result[name][pra]={native_cells:q.native_cells,physical_land_mask_available:true,source_land_fraction:q.source_land_fraction,mask_sha256:q.mask_sha256};}}return result;})();landCache={sha:e.sha256,value};void value.catch(()=>{if(landCache?.value===value)landCache=undefined;});return value;
}
