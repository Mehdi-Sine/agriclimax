import 'server-only';
import {ApiError} from './query';

type RecordValue = Record<string, unknown>;
const record=(v:unknown):v is RecordValue=>typeof v==='object' && v!==null && !Array.isArray(v);
const code=/^[A-Za-z0-9_.:-]{1,100}$/;
export interface TerritoryRow {
  id:string; name:string; area_km2:number; department_code:string; region_code:string;
  official_code?:string; department_name?:string; region_name?:string;
  valid_date?:string|null; temperature?:number|null; temperature_min?:number|null;
  temperature_max?:number|null; precipitation?:number|null; coverage?:number[]|null;
  expected_cells?:number|null; valid_counts?:number[]|null; status?:string;
  freshness?:string; computed_at?:string|null; batch_key?:string|null; quality_flags?:string[]|null;
  cattle_status?:string;
}
export interface TerritoryPage {reference_version:string;dataset_version?:string;units?:Record<string,string>;data:TerritoryRow[];next_cursor:string|null;source_id:'era5-land'|'official-pra-reference';source_kind:'reanalysis'|'geographic_reference';method_version:'pra-native-1';state:'available'|'partial'|'unavailable'}
function dateValid(value:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000')
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
}
export async function territoryData(params:URLSearchParams,transport:typeof fetch=fetch):Promise<TerritoryPage> {
  const action=params.get('action')||'lookup';
  const allowed=action==='lookup'?['action','reference','department','region','q','after','limit']:['action','reference','dataset','date','scope','id','after','limit'];
  if(!['lookup','read'].includes(action))throw new ApiError('INVALID_QUERY',400);
  for(const k of params.keys())if(!allowed.includes(k)||params.getAll(k).length!==1)throw new ApiError('INVALID_QUERY',400);
  const reference=params.get('reference')||'';
  const after=params.get('after')||'';
  const limit=params.get('limit')||'50';
  if(!code.test(reference)||after && !/^pra:[0-9AB]{4,8}$/.test(after)||!/^\d{1,3}$/.test(limit)||Number(limit)<1||Number(limit)>100)throw new ApiError('INVALID_QUERY',400);
  let body:RecordValue;
  if(action==='lookup') {
    const department=params.get('department')||null,region=params.get('region')||null,q=params.get('q')||'';
    if(department && !/^(?:\d{2}|2[AB])$/.test(department)||region && !/^\d{2}$/.test(region)||q.length>100)throw new ApiError('INVALID_QUERY',400);
    body={p_version:reference,p_department:department,p_region:region,p_query:q,p_after:after,p_limit:Number(limit)};
  } else {
    const dataset=params.get('dataset')||'',date=params.get('date')||'',scope=params.get('scope')||'',id=params.get('id')||'';
    if(!code.test(dataset)||!dateValid(date)||!['pra','department','region','france'].includes(scope)
      ||(scope==='pra'&&!/^pra:[0-9AB]{4,8}$/.test(id))||(scope==='department'&&!/^(?:\d{2}|2[AB])$/.test(id))
      ||(scope==='region'&&!/^\d{2}$/.test(id))||(scope==='france'&&id!==''))throw new ApiError('INVALID_QUERY',400);
    body={p_reference:reference,p_dataset:dataset,p_date:date,p_scope:scope,p_id:id,p_after:after,p_limit:Number(limit)};
  }
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!base||!key)throw new ApiError('NOT_CONFIGURED',503);
  let url:URL;
  try {url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();}
  catch {throw new ApiError('NOT_CONFIGURED',503);}
  url.pathname=`/rest/v1/rpc/agriclimax_pra_${action==='lookup'?'lookup':'read'}`;
  const response=await transport(url,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw new ApiError('UPSTREAM_UNAVAILABLE',502);
  const text=await response.text();
  if(text.length>300_000)throw new ApiError('INVALID_RESPONSE',502);
  const raw:unknown=JSON.parse(text);
  if(action==='read'&&(!record(raw)||raw.source_id!=='era5-land'||raw.source_kind!=='reanalysis'||raw.method_version!=='pra-native-1'))throw new ApiError('INVALID_RESPONSE',502);
  if(!record(raw)||!Array.isArray(raw.data)||raw.data.length>Number(limit)||!(raw.next_cursor===null||typeof raw.next_cursor==='string'))throw new ApiError('INVALID_RESPONSE',502);
  const data:TerritoryRow[]=raw.data.map((r:unknown)=>{
    if(!record(r)||typeof r.id!=='string'||!/^pra:[0-9AB]{4,8}$/.test(r.id)||r.id<=after
      ||typeof r.name!=='string'||r.name.length>200||typeof r.area_km2!=='number'||!Number.isFinite(r.area_km2)||r.area_km2<=0
      ||typeof r.department_code!=='string'||typeof r.region_code!=='string')throw new ApiError('INVALID_RESPONSE',502);
    const projected:TerritoryRow={id:r.id,name:r.name,area_km2:r.area_km2,department_code:r.department_code,region_code:r.region_code};
    if(action==='lookup') {
      for(const k of ['official_code','department_name','region_name'] as const) {
        if(typeof r[k]!=='string'||r[k].length>200)throw new ApiError('INVALID_RESPONSE',502);
        projected[k]=r[k];
      }
    } else {
      if(!['available','partial','unavailable'].includes(String(r.status))||!['stale','recent_reanalysis'].includes(String(r.freshness)))throw new ApiError('INVALID_RESPONSE',502);
      for(const k of ['temperature','temperature_min','temperature_max','precipitation'] as const) {
        if(!(r[k]===null||typeof r[k]==='number'&&Number.isFinite(r[k])))throw new ApiError('INVALID_RESPONSE',502);
        projected[k]=r[k] as number|null;
      }
      if(!(r.coverage===null||Array.isArray(r.coverage)&&r.coverage.length===4&&r.coverage.every(v=>typeof v==='number'&&v>=0&&v<=1.0001)))throw new ApiError('INVALID_RESPONSE',502);
      if(!(r.valid_counts===null||Array.isArray(r.valid_counts)&&r.valid_counts.length===4&&r.valid_counts.every(v=>Number.isInteger(v)&&v>=0&&v<=1000)))throw new ApiError('INVALID_RESPONSE',502);
      if(!(r.expected_cells===null||typeof r.expected_cells==='number'&&Number.isInteger(r.expected_cells)&&r.expected_cells>0&&r.expected_cells<=1000))throw new ApiError('INVALID_RESPONSE',502);
      if(!(r.valid_date===null||r.valid_date===params.get('date'))||!(r.batch_key===null||typeof r.batch_key==='string'&&/^[a-f0-9]{64}$/.test(r.batch_key))
        ||!(r.computed_at===null||typeof r.computed_at==='string'&&Number.isFinite(Date.parse(r.computed_at))))throw new ApiError('INVALID_RESPONSE',502);
      if(!(r.quality_flags===null||Array.isArray(r.quality_flags)&&r.quality_flags.length<=30&&r.quality_flags.every(v=>typeof v==='string'&&v.length<=100)))throw new ApiError('INVALID_RESPONSE',502);
      if(r.status==='available'&&(['temperature','temperature_min','temperature_max','precipitation'].some(k=>r[k]===null)||r.coverage===null||!Array.isArray(r.coverage)||r.coverage.some(v=>v<0.9999)||r.expected_cells===null||!Array.isArray(r.valid_counts)||r.valid_counts.some(v=>v!==r.expected_cells)))throw new ApiError('INVALID_RESPONSE',502);
      const noNativeValues=Array.isArray(r.valid_counts)&&r.valid_counts.every(v=>v===0)
        &&['temperature','temperature_min','temperature_max','precipitation'].every(k=>r[k]===null);
      Object.assign(projected,{coverage:r.coverage,valid_counts:r.valid_counts,expected_cells:r.expected_cells,status:noNativeValues?'unavailable':r.status,
        valid_date:r.valid_date,batch_key:r.batch_key,computed_at:r.computed_at,quality_flags:r.quality_flags,freshness:r.freshness,
        cattle_status:'unsupported_missing_humidity_and_grid_model_validation'});
    }
    return projected;
  });
  if(data.some((r,i)=>i>0&&r.id<=data[i-1].id)||raw.next_cursor!==null&&raw.next_cursor!==data.at(-1)?.id)throw new ApiError('INVALID_RESPONSE',502);
  return {reference_version:reference,...(action==='read'?{dataset_version:params.get('dataset')!,units:{temperature:'degC',temperature_min:'degC',temperature_max:'degC',precipitation:'mm'}}:{}),data,next_cursor:raw.next_cursor as string|null,source_id:action==='read'?'era5-land':'official-pra-reference',source_kind:action==='read'?'reanalysis':'geographic_reference',method_version:'pra-native-1',state:action==='lookup'?(data.length?'available':'unavailable'):data.some(r=>r.status!=='unavailable')?(data.every(r=>r.status==='available')?'available':'partial'):'unavailable'};
}
export async function readTerritories(request:Request,transport:typeof fetch=fetch) {
  try {return Response.json(await territoryData(new URL(request.url).searchParams,transport),{headers:{'Cache-Control':'no-store'}});}
  catch(error) {const safe=error instanceof ApiError?error:new ApiError('UPSTREAM_UNAVAILABLE',502);return Response.json({error:safe.code},{status:safe.status});}
}
