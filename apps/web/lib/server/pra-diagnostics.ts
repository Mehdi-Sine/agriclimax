import 'server-only';
import {ApiError} from './query';
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export async function readPraDiagnostics(request:Request,transport:typeof fetch=fetch) {
  try {
    const q=new URL(request.url).searchParams;
    const keys=['reference','dataset','pra','start','end','parameters'];
    if([...q.keys()].some(k=>!keys.includes(k)||q.getAll(k).length!==1)||keys.some(k=>!q.get(k)))throw new ApiError('INVALID_QUERY',400);
    const reference=q.get('reference')!,dataset=q.get('dataset')!,pra=q.get('pra')!,start=q.get('start')!,end=q.get('end')!,parameters=q.get('parameters')!;
    const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!s.startsWith('0000')&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
    if(!/^[A-Za-z0-9_.-]{1,80}$/.test(reference)||!/^[A-Za-z0-9_.-]{1,100}$/.test(dataset)||!/^pra:[0-9AB]{4,8}$/.test(pra)
      ||!date(start)||!date(end)||end<start||Date.parse(end)-Date.parse(start)>365*86400000||!/^[a-f0-9]{64}$/.test(parameters))throw new ApiError('INVALID_QUERY',400);
    const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
    if(!base||!key)throw new ApiError('NOT_CONFIGURED',503);
    let url:URL;
    try {url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();}
    catch {throw new ApiError('NOT_CONFIGURED',503);}
    url.pathname='/rest/v1/rpc/agriclimax_pra_diagnostics';
    const response=await transport(url,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({p_reference:reference,p_dataset:dataset,p_pra:pra,p_start:start,p_end:end,p_parameters:parameters})});
    if(!response.ok)throw new ApiError('UPSTREAM_UNAVAILABLE',502);
    const text=await response.text();if(text.length>20_000)throw new ApiError('INVALID_RESPONSE',502);
    const raw:unknown=JSON.parse(text);
    if(!record(raw)||raw.source_id!=='era5-land'||raw.source_kind!=='reanalysis'||raw.risk_computed!==false||raw.scientific_status!=='exploratory'||!Array.isArray(raw.data)||raw.data.length>8)throw new ApiError('INVALID_RESPONSE',502);
    const data=raw.data.map((r:unknown)=>{
      if(!record(r)||typeof r.indicator_id!=='string'||!/^wheat\.(gdd|heat_days|heat_spell_max|frost_days|frost_spell_max|precipitation_sum|dry_days|dry_spell_max)$/.test(r.indicator_id)
        ||r.rule_version!=='wheat-climate-1'||!['degC day','day','mm'].includes(String(r.unit))||r.start_date!==start||r.end_date!==end
        ||!(r.value===null||typeof r.value==='number'&&Number.isFinite(r.value))||typeof r.coverage!=='number'||r.coverage<0||r.coverage>1.0001
        ||typeof r.valid_cells!=='number'||!Number.isInteger(r.valid_cells)||typeof r.expected_cells!=='number'||!Number.isInteger(r.expected_cells)
        ||r.expected_cells<1||r.expected_cells>1000||r.valid_cells<0||r.valid_cells>r.expected_cells||r.value!==null&&r.valid_cells!==r.expected_cells
        ||typeof r.batch_key!=='string'||!/^[a-f0-9]{64}$/.test(r.batch_key)||r.spatial_method!=='area_weighted_mean_of_native_indicator')throw new ApiError('INVALID_RESPONSE',502);
      return {indicator_id:r.indicator_id,rule_version:r.rule_version,unit:r.unit,start_date:start,end_date:end,value:r.value,
        valid_cells:r.valid_cells,expected_cells:r.expected_cells,coverage:r.coverage,spatial_method:r.spatial_method,
        data_freshness:Math.floor(Date.now()/86400000)-Math.floor(Date.parse(end)/86400000)>5?'stale':'fresh',
        quality_flags:['total_area_not_agricultural_area','exploratory','utc_daily_reduction','publication_time_unknown',...(r.valid_cells===r.expected_cells?[]:['missing_cells'])],
        provenance:{source_id:'era5-land',source_kind:'reanalysis',batch_key:r.batch_key,reference_version:reference,dataset_version:dataset},provenance_ref:r.batch_key,status:r.value===null?'unavailable':'available'};
    });
    if(new Set(data.map(r=>r.indicator_id)).size!==data.length)throw new ApiError('INVALID_RESPONSE',502);
    return Response.json({reference_version:reference,dataset_version:dataset,pra_id:pra,parameters_sha256:parameters,source_id:'era5-land',source_kind:'reanalysis',
      risk_computed:false,scientific_status:'exploratory',confidence:'low',data,state:data.some(r=>r.value!==null)?'available':'unavailable'}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {const safe=error instanceof ApiError?error:new ApiError('UPSTREAM_UNAVAILABLE',502);return Response.json({error:safe.code},{status:safe.status});}
}
