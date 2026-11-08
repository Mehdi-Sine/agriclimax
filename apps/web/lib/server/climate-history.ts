import 'server-only';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import bootstrap from '../../data/operational/legacy-era5.json';
import identities from '../../data/operational/pra-identities.json';
import {calendarDays} from '../../features/national/daily-availability';
import {NATIONAL} from '../../features/national/model';
import {archiveCatalogue, archivedEra5Day, type ArchivedDaily} from './weather-archives';
import {record} from './weather-archive-codec';

type Receipt = {sha256:string; bytes:number; content:string};
const days:Record<string,Receipt> = bootstrap.days;
const legacyCache = new Map<string,ArchivedDaily[]>();
export const legacyHistoryDates = Object.keys(days).sort();
/** Explicit separate series: never presented as original exact envelope bytes. */
export function legacyHistoryDay(date:string):ArchivedDaily[]|null {
  const receipt=days[date];if(!receipt)return null;
  const hit=legacyCache.get(date);if(hit)return hit;
  const raw=Buffer.from(receipt.content,'base64');
  if(bootstrap.version!=='pra-legacy-adapter-1'||raw.length!==receipt.bytes||createHash('sha256').update(raw).digest('hex')!==receipt.sha256)throw new Error('LEGACY_INTEGRITY');
  const rows:unknown=JSON.parse(gunzipSync(raw,{maxOutputLength:4*1024**2}).toString());
  if(!Array.isArray(rows)||rows.length!==713)throw new Error('LEGACY_IDENTITIES');
  for(const r of rows){
    if(!record(r)||r.valid_date!==date||typeof r.pra_id!=='string'||!identities.ids.includes(r.pra_id)||!record(r.identity)||!record(r.identity.dataset)||r.identity.dataset.dataset_version!==NATIONAL.dataset||r.identity.dataset.source_id!=='era5-land'||r.identity.method!=='pra-native-1'||r.identity.pra!==r.pra_id||typeof r.batch_key!=='string'||!/^[a-f0-9]{64}$/.test(r.batch_key)||typeof r.computed_at!=='string'||!Number.isFinite(Date.parse(r.computed_at)))throw new Error('LEGACY_PROVENANCE');
    for(const field of ['temperature','temperature_min','temperature_max','precipitation'])if(r[field]!==null&&(typeof r[field]!=='number'||!Number.isFinite(r[field])))throw new Error('LEGACY_VALUE');
    if(!Array.isArray(r.coverage)||r.coverage.length!==4||!r.coverage.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1.0001)||!Array.isArray(r.valid_counts)||r.valid_counts.length!==4||!r.valid_counts.every(v=>Number.isInteger(v)&&v>=0)||typeof r.expected_cells!=='number'||!Number.isInteger(r.expected_cells)||!['available','partial','unavailable'].includes(String(r.status))||!Array.isArray(r.quality_flags)||!r.quality_flags.every(v=>typeof v==='string'))throw new Error('LEGACY_SUPPORT');
  }
  if(new Set(rows.map(r=>(r as ArchivedDaily).pra_id)).size!==713)throw new Error('LEGACY_IDENTITIES');
  const result=rows as ArchivedDaily[];
  if(legacyCache.size>=30)legacyCache.delete(legacyCache.keys().next().value!);
  legacyCache.set(date,result);return result;
}
/** One transport/precision series for the entire requested period, with no splice. */
export async function climateHistoryWindow(dates:string[]) {
  if(!dates.length||dates.length>30||calendarDays(dates[0],dates.at(-1)!).join()!==dates.join())throw new Error('HISTORY_PERIOD');
  const catalogue=await archiveCatalogue();
  const entries=catalogue?.era5.filter(e=>e.dates.some(d=>dates.includes(d)))??[];
  const modernComplete=dates.every(d=>entries.some(e=>e.dates.includes(d)));
  const legacyComplete=dates.every(d=>days[d]);
  const series=modernComplete||!legacyComplete?'exact-storage-1':'legacy-rpc-1';
  const rows:ArchivedDaily[]=[];
  for(const d of dates){
    if(series==='exact-storage-1'&&!entries.some(e=>e.dates.includes(d)))continue;
    const one=series==='legacy-rpc-1'?legacyHistoryDay(d):await archivedEra5Day(d);
    if(one)rows.push(...one);
  }
  const revisions=series==='legacy-rpc-1'?dates.map(d=>days[d].sha256):entries.map(e=>e.sha256);
  const version=createHash('sha256').update(JSON.stringify([series,revisions,catalogue?.supports?.filter(e=>e.dates.some(d=>dates.includes(d))).map(e=>e.sha256)??[]])).digest('hex');
  return {rows,series,version,complete:modernComplete||legacyComplete};
}
