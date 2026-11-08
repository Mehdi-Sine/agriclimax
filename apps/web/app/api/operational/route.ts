import {weatherQualityBundle} from "../../../features/climate-quality/adapters";
import 'server-only';
import {completeForecastCycle,VARIABLES,type WeatherCycle,type WeatherModel,type WeatherRow,type CoastalQualification} from '../../../features/operational/model';
import pilot from '../../../data/operational/cycle.json';
import {record} from '../../../lib/server/weather-archive-codec';
import {nationalWeatherDocument,nationalLandMasks} from '../../../lib/server/weather-archives';
import {isCalendarDate} from '../../../features/national/daily-availability';

export const runtime='nodejs';
export const maxDuration=30;
const MODELS:{id:WeatherModel;label:string}[]=[{id:'selected',label:'Sélection nationale · un modèle par jour'},{id:'arome',label:'Météo-France AROME 0,025°'},{id:'arpege',label:'Météo-France ARPEGE 0,1°'},{id:'ifs',label:'ECMWF IFS 0,25°'}];
const SOURCE={arome:'meteofrance-arome',arpege:'meteofrance-arpege',ifs:'ecmwf-open-data'};
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,allowed=['experimental','model','date','variable','pra','catalogue','run'];
  const requestedRun=p.get('run'),model=p.get('model')??'selected',date=p.get('date'),variable=p.get('variable'),pra=p.get('pra');
  if(p.get('experimental')!=='weather'||[...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1))return Response.json({error:'EXPERIMENTAL_OPT_IN_REQUIRED'},{status:400});
  if(requestedRun&&!(isCalendarDate(requestedRun)||/^\d{4}-\d{2}-\d{2}T(?:00|06|12|18):00:00(?:Z|\+00:00)$/.test(requestedRun)&&isCalendarDate(requestedRun.slice(0,10))&&Number.isFinite(Date.parse(requestedRun)))||!MODELS.some(m=>m.id===model)||date&&!isCalendarDate(date)||variable&&!VARIABLES.some(v=>v.id===variable)||pra&&!/^pra:[0-9A-Z]{5}$/.test(pra)||p.has('catalogue')&&(p.get('catalogue')!=='1'||date||variable||pra))return Response.json({error:'INVALID_WEATHER_QUERY'},{status:400});
  try{
    const national=await nationalWeatherDocument(requestedRun??undefined);
    if(requestedRun&&!national)return Response.json({error:'ARCHIVED_CYCLE_NOT_AVAILABLE'},{status:404});
    let rows:WeatherRow[],cycle:WeatherCycle;
    if(national){
      rows=model==='selected'?national.selected_indices.map(i=>national.rows[i]):national.rows.filter(r=>r.source_id===SOURCE[model as keyof typeof SOURCE]);
      cycle={scope:'national',run:national.run,acquired_at:national.acquired_at,pra_count:713,rows:[],recent_estimate_status:national.recent_estimate_status,attribution:national.attribution,models:MODELS,selected_model:model as WeatherModel};
    }else{
      if(model!=='selected'&&model!=='ifs')return Response.json({error:'MODEL_NOT_AVAILABLE'},{status:404});
      if(!completeForecastCycle(pilot as WeatherCycle))return Response.json({error:'INVALID_CYCLE'},{status:503});
      rows=pilot.rows as WeatherRow[];cycle={...pilot,scope:'pilot',models:MODELS.filter(m=>m.id==='selected'||m.id==='ifs'),selected_model:model as WeatherModel,rows:[]};
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
    return Response.json({...cycle,coverage_quality:weatherQualityBundle(selectedRows),coastal_qualification:qualification,available_dates:dates,all_dates:national?[...new Set(national.rows.map(r=>r.valid_date))].sort():dates,pra_ids:ids,rows:selectedRows},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'VERIFIED_WEATHER_SOURCE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
