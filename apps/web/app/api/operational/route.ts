import {forecastMasks} from "../../../lib/server/forecast-masks";
import {weatherQualityBundle} from "../../../features/climate-quality/adapters";
import 'server-only';
import {completeForecastCycle,VARIABLES,WEATHER_MODEL_SOURCES,type WeatherCycle,type WeatherModel,type WeatherRow,type CoastalQualification} from '../../../features/operational/model';
import pilot from '../../../data/operational/cycle.json';
import {record} from '../../../lib/server/weather-archive-codec';
import {archiveCatalogue,nationalWeatherDocument,nationalLandMasks} from '../../../lib/server/weather-archives';
import {isCalendarDate} from '../../../features/national/daily-availability';

export const runtime='nodejs';
export const preferredRegion='cdg1';
export const maxDuration=30;
const MODELS:{id:WeatherModel;label:string}[]=[{id:'selected',label:'Sélection nationale · un modèle par jour'},{id:'arome',label:'Météo-France AROME 0,025°'},{id:'arpege',label:'Météo-France ARPEGE 0,1°'},{id:'ifs',label:'ECMWF IFS 0,25°'}];
import {forecastIndexLocation, forecastIndexPin} from '../../../lib/server/forecast-index';
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,allowed=['experimental','model','date','variable','pra','catalogue','run'];
  const requestedRun=p.get('run'),model=p.get('model')??'selected',date=p.get('date'),variable=p.get('variable'),pra=p.get('pra');
  if(p.get('experimental')!=='weather'||[...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1))return Response.json({error:'EXPERIMENTAL_OPT_IN_REQUIRED'},{status:400});
  if(requestedRun&&!(isCalendarDate(requestedRun)||/^\d{4}-\d{2}-\d{2}T(?:00|06|12|18):00:00(?:Z|\+00:00)$/.test(requestedRun)&&isCalendarDate(requestedRun.slice(0,10))&&Number.isFinite(Date.parse(requestedRun)))||!MODELS.some(m=>m.id===model)||date&&!isCalendarDate(date)||variable&&!VARIABLES.some(v=>v.id===variable)||pra&&!/^pra:[0-9A-Z]{5}$/.test(pra)||p.has('catalogue')&&(p.get('catalogue')!=='1'||date||variable||pra))return Response.json({error:'INVALID_WEATHER_QUERY'},{status:400});
  try{
    const started = performance.now();
    let national=await nationalWeatherDocument(requestedRun??undefined);
    const useDailyIndex = process.env.COUV05_RENDER_ENABLED === 'true' && process.env.COUV05_DAILY_INDEX_ENABLED === 'true';
    const fallbackNeeded = useDailyIndex && national && !requestedRun && !date && !pra &&
      !await forecastIndexLocation(national.archive_sha256).catch(() => undefined);
    const available = (useDailyIndex && (p.has('catalogue') || fallbackNeeded))
      ? await indexedWeatherRuns() : [];
    if (!requestedRun && available[0] && (fallbackNeeded || p.has('catalogue')) &&
        available[0].sha256 !== national?.archive_sha256) {
      national = await nationalWeatherDocument(available[0].run_at, available[0].sha256) ?? national;
    }
    const archiveMs = performance.now() - started;
    if(requestedRun&&!national)return Response.json({error:'ARCHIVED_CYCLE_NOT_AVAILABLE'},{status:404});
    let rows:WeatherRow[],cycle:WeatherCycle;
    if(national){
      rows=model==='selected'?national.selected_indices.map(i=>national.rows[i]):national.rows.filter(r=>r.source_id===WEATHER_MODEL_SOURCES[model as keyof typeof WEATHER_MODEL_SOURCES]);
      cycle={scope:'national',run:national.run,acquired_at:national.acquired_at,pra_count:713,rows:[],recent_estimate_status:national.recent_estimate_status,attribution:national.attribution,models:MODELS,selected_model:model as WeatherModel};
    }else{
      if(model!=='selected'&&model!=='ifs')return Response.json({error:'MODEL_NOT_AVAILABLE'},{status:404});
      if(!completeForecastCycle(pilot as WeatherCycle))return Response.json({error:'INVALID_CYCLE'},{status:503});
      rows=pilot.rows as WeatherRow[];cycle={...pilot,scope:'pilot',models:MODELS.filter(m=>m.id==='selected'||m.id==='ifs'),selected_model:model as WeatherModel,rows:[]};
    }
    if (national && p.has('catalogue') && useDailyIndex) {
      cycle.available_runs = available.map(entry => entry.run_at);
    } else if (national && p.has('catalogue') && process.env.COUV05_RENDER_ENABLED === 'true' &&
        process.env.COUV05_ARCHIVE_INDEX_PINS !== undefined) {
      const catalogue = await archiveCatalogue();
      cycle.available_runs = [...new Set(catalogue?.weather.flatMap(entry =>
        entry.method_version === 'pra-national-weather-daily-1' && entry.run_at && forecastIndexPin(entry.sha256)
          ? [entry.run_at] : [],
      ))].sort().reverse();
    }
    const qualification:Record<string,CoastalQualification>={};
    const audit=national?.coastal_audit;
    if(pra&&record(audit)&&record(audit.sources))for(const [source,values] of Object.entries(audit.sources)){
      if(!record(values))continue;const q=values[pra];
      if(record(q)&&typeof q.native_cells==='number'&&typeof q.physical_land_mask_available==='boolean')qualification[source]={native_cells:q.native_cells,physical_land_mask_available:q.physical_land_mask_available,...(typeof q.centre_inside_reference_fraction==='number'?{centre_inside_reference_fraction:q.centre_inside_reference_fraction}:{}),...(q.source_land_fraction===null||typeof q.source_land_fraction==='number'?{source_land_fraction:q.source_land_fraction}:{})};
    }
    if(pra){const masks=await nationalLandMasks();if(masks)for(const [model,values] of Object.entries(masks))if(values[pra])qualification[model]=values[pra];}
    const dates=[...new Set(rows.map(r=>r.valid_date))].sort(),ids=[...new Set(rows.map(r=>r.pra_id))].sort();
    if(date&&!dates.includes(date)||pra&&!ids.includes(pra))return Response.json({error:'DATE_OR_PRA_NOT_AVAILABLE'},{status:404});
    // Serverless response limits: national maps expose one date/variable (713 rows),
    // while a selected-PRA history remains bounded to 45 rows. Whole archives stay private.
    const effectiveDate=national&&!pra&&!p.has('catalogue')?(date??(dates.includes(national.run.slice(0,10))?national.run.slice(0,10):dates[0])):date;
    const effectiveVariable=national&&!pra&&!p.has('catalogue')?(variable??'temperature'):variable;
    const selectedRows=p.get('catalogue')==='1'?[]:rows.filter(r=>(!effectiveDate||r.valid_date===effectiveDate)&&(!effectiveVariable||r.variable===effectiveVariable)&&(!pra||r.pra_id===pra));
    const location = national && selectedRows.length && !pra
      ? await forecastIndexLocation(national.archive_sha256).catch(() => undefined) : undefined;
    const key = location && national ? JSON.stringify([
      'forecast-map-v1', national.archive_sha256, location.pin, location.prefix,
      model, effectiveDate, effectiveVariable,
    ]) : undefined;
    const beforeMasks = performance.now();
    const { body, maskMs, responseMs, cached, verified } = await mapResponse(key, async () => {
      const spatial = national && (!pra || date && variable) ? await forecastMasks(selectedRows,national.archive_sha256) : undefined;
      const maskMs = performance.now() - beforeMasks;
      const beforeResponse = performance.now();
      const native = spatial && national ? {
        forecast_support: spatial.collection,
        native_support: {archive_sha256: national.archive_sha256,
          status: spatial.reason ?? (spatial.proofs.length ? 'verified' : 'no_verified_support')},
      } : {};
      const body = JSON.stringify({...cycle,...native,coverage_quality:weatherQualityBundle(selectedRows,spatial),coastal_qualification:qualification,available_dates:dates,all_dates:national?[...new Set(national.rows.map(r=>r.valid_date))].sort():dates,pra_ids:ids,rows:selectedRows});
      return {body, maskMs, responseMs: performance.now() - beforeResponse, verified: !!spatial?.proofs.length && !spatial.reason};
    });
    const response = new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    // This response is the same for every reader of an exact, committed public map.
    // The cycle-less catalogue and user-selected PRA details always bypass the edge cache.
    if (verified && location?.certified && requestedRun === national?.run && date && variable && !pra) {
      response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=60');
    }
    response.headers.set('Server-Timing', `archive;dur=${archiveMs.toFixed(1)}, masks;dur=${maskMs.toFixed(1)}, response;dur=${responseMs.toFixed(1)}, map-cache;desc="${cached ? 'hit' : 'miss'}"`);
    return response;
  }catch{return Response.json({error:'VERIFIED_WEATHER_SOURCE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}


async function indexedWeatherRuns() {
  const catalogue = await archiveCatalogue();
  const entries = (catalogue?.weather ?? [])
    .flatMap(entry => entry.method_version === 'pra-national-weather-daily-1' && entry.run_at
      ? [{ ...entry, run_at: entry.run_at }] : [])
    .sort((a, b) => Date.parse(b.run_at) - Date.parse(a.run_at));
  const recent = entries.slice(0, 12);
  const locations = await Promise.all(recent.map(entry => forecastIndexLocation(entry.sha256).catch(() => undefined)));
  return entries.filter((entry, i) => i < recent.length ? !!locations[i] :
    process.env.COUV05_ARCHIVE_INDEX_PINS !== undefined && !!forecastIndexPin(entry.sha256));
}

type MapResponse = { body: string; maskMs: number; responseMs: number; verified: boolean };
const mapCache = new Map<string, { pending: Promise<MapResponse>; bytes: number; expires: number }>();
let mapCacheBytes = 0;

function forgetMap(key: string) {
  mapCacheBytes -= mapCache.get(key)?.bytes ?? 0;
  mapCache.delete(key);
}

async function mapResponse(key: string | undefined, prepare: () => Promise<MapResponse>) {
  if (!key) return { ...await prepare(), cached: false };
  const hit = mapCache.get(key);
  if (hit && hit.expires > Date.now()) {
    mapCache.delete(key);
    mapCache.set(key, hit);
    const result = await hit.pending;
    return { ...result, maskMs: 0, responseMs: 0, cached: true };
  }
  forgetMap(key);
  if (mapCache.size >= 24) forgetMap(mapCache.keys().next().value!);
  const pending = prepare();
  const entry = { pending, bytes: 0, expires: Date.now() + 60_000 };
  mapCache.set(key, entry);
  void pending.then(result => {
    if (mapCache.get(key) !== entry) return;
    if (!result.verified) {
      forgetMap(key);
      return;
    }
    entry.bytes = Math.max(Buffer.byteLength(result.body), result.body.length * 2);
    mapCacheBytes += entry.bytes;
    while (mapCacheBytes > 12 * 1024 ** 2) forgetMap(mapCache.keys().next().value!);
  }, () => {
    if (mapCache.get(key) === entry) forgetMap(key);
  });
  return { ...await pending, cached: false };
}
