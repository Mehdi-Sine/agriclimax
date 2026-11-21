import 'server-only';
import identities from '../../data/operational/pra-identities.json';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { FORECAST_MASK_VERSION, boundForecastGeometries, forecastSpatialQuality, type ForecastSupport } from '../../features/cartography/forecast-support';
import type { WeatherRow } from '../../features/operational/model';
import type { PraCollection } from '../../features/national/map';
import { record } from './weather-archive-codec';
import { coveragePaint } from '../../features/cartography/coverage';
import { FORECAST_REFERENCE_SHA256, forecastIndexPin } from './forecast-index';
import { forecastMaskObject } from './weather-archives';
const hash = (raw: Uint8Array) => createHash('sha256').update(raw).digest('hex');
const empty = (): PraCollection => ({type:'FeatureCollection', features:[]});
function unpack(raw:Uint8Array|null,sha:string,budget:{packed:number;decoded:number}):unknown {
  if(!raw || raw.length > 8*1024**2 || hash(raw)!==sha)throw Error('FORECAST_MASK_INTEGRITY');
  budget.packed+=raw.length;if(budget.packed>16*1024**2)throw Error('FORECAST_MASK_TRANSFER_BUDGET');
  const body=gunzipSync(raw,{maxOutputLength:64*1024**2-budget.decoded});budget.decoded+=body.length;
  return JSON.parse(body.toString());
}
function support(value:unknown):value is ForecastSupport {
  if(!record(value))return false;
  return ['pra_id','model','run','period','variable','grid_version','weights_sha256','pra_weights_sha256','reference_sha256','source_sha256'].every(k=>typeof value[k]==='string') &&
    (value.support_id===null || typeof value.support_id==='string') &&
    (value.fraction===null || typeof value.fraction==='number') &&
    (value.valid_cells===undefined||value.valid_cells===null||Array.isArray(value.valid_cells)&&value.valid_cells.every(c=>typeof c==='string')) &&
    typeof value.geometry_verified==='boolean' && ['unknown','absent','partial','demonstrated'].includes(String(value.status));
}
/** Exact immutable archive + index binding. Failure gives unknown support, never an aggregate fallback. */
export async function forecastMasks(rows:WeatherRow[], archiveSha:string, options?:{identicalMemberships:boolean}) {
  if(process.env.COUV05_RENDER_ENABLED!=='true')return undefined;
  if(!rows.length)return undefined;
  const proofs:ForecastSupport[]=[];
  const membershipRejections:Record<string,string>={};
  const budget={packed:0,decoded:0},shards=new Map<string,unknown>();
  let collection=empty(),referenceSha='';
  try {
    const pin=forecastIndexPin(archiveSha);
    if(!pin)throw Error('FORECAST_MASK_INDEX_PIN');
    const index=unpack(await forecastMaskObject(`forecast-masks/indexes/${pin}.json.gz`,1024**2),pin,budget);
    if(!record(index)||index.version!==FORECAST_MASK_VERSION||index.archive_sha256!==archiveSha||!Array.isArray(index.entries)||index.entries.length>200)throw Error('FORECAST_MASK_ARCHIVE_BINDING');
    referenceSha=FORECAST_REFERENCE_SHA256;
    const modelNames: Record<string, string> = {'arome-0p025':'arome','arpege-0p1':'arpege','ifs-oper-0p25':'ifs'};
    const keys = new Set(rows.map(row => JSON.stringify([
      modelNames[row.model], row.valid_date, row.variable, Date.parse(row.model_run_at ?? ''),
    ])));
    const wanted = index.entries.filter((entry:unknown) => record(entry) &&
      keys.has(JSON.stringify([entry.model, entry.period, entry.variable, Date.parse(String(entry.run))])));
    if(!wanted.length)throw Error('FORECAST_MASK_NO_MATCHING_ENTRY');
    if(wanted.length>(options?.identicalMemberships?14:5))throw Error('FORECAST_MASK_REQUEST_BUDGET');
    const baseline=new Map<string,{proof:ForecastSupport;feature:PraCollection['features'][number]}>();
    let firstManifest=true;
    for(const entry of wanted){
      if(!record(entry)||typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256)||entry.path!==`forecast-masks/blobs/${entry.sha256}.json.gz`)throw Error('FORECAST_MASK_ENTRY');
      const raw=await forecastMaskObject(String(entry.path),8*1024**2);
      if(!raw||raw.length!==entry.bytes)throw Error('FORECAST_MASK_SIZE');
      const d=unpack(raw,entry.sha256,budget);
      if(!record(d)||d.version!==FORECAST_MASK_VERSION||!Array.isArray(d.rows)||d.rows.length!==713||!d.rows.every(support)||new Set(d.rows.map(p=>p.pra_id)).size!==713||d.rows.some(p=>!identities.ids.includes(p.pra_id))||!record(d.collection)||d.collection.type!=='FeatureCollection'||!Array.isArray(d.collection.features))throw Error('FORECAST_MASK_SCHEMA');
      for(const key of ['model','run','period','variable','grid_version','reference_sha256','weights_sha256'])if(d[key]!==entry[key]||d.rows.some(p=>p[key as keyof ForecastSupport]!==entry[key]))throw Error('FORECAST_MASK_IDENTITY');
      if(d.reference_sha256!==referenceSha)throw Error('FORECAST_MASK_REFERENCE');
      // Geometry topology/area is certified by the producer; immutable bytes and identities are checked here.
      let features:unknown[]=d.collection.features;
      if(options?.identicalMemberships&&!firstManifest){
        // A second variable/day may reuse coordinates only for exactly the same
        // certified cells in this PRA. Changing sets stay unknown: no union,
        // fraction approximation or replacement geometry is allowed here.
        features=d.rows.flatMap(p=>{
          const prior=baseline.get(p.pra_id),cells=p.valid_cells;
          if(!prior||!p.geometry_verified||!cells?.length||!prior.proof.valid_cells)return [];
          if(['model','run','grid_version','reference_sha256','weights_sha256','pra_weights_sha256'].some(k=>p[k as keyof ForecastSupport]!==prior.proof[k as keyof ForecastSupport])||
            JSON.stringify([...cells].sort())!==JSON.stringify([...prior.proof.valid_cells].sort())){
            membershipRejections[p.pra_id]='common_cells_require_native_numeric_recalculation';return [];
          }
          return [{...prior.feature,properties:{...prior.feature.properties,support_id:p.support_id}}];
        });
      }else if(d.geometry_entries!==undefined){
        if(!Array.isArray(d.geometry_entries)||d.geometry_entries.length>12||features.length)throw Error('FORECAST_MASK_GEOMETRY_INDEX');
        const byId=new Map(d.rows.map(p=>[p.pra_id,p]));
        const groups=await Promise.all(d.geometry_entries.map(async(ref:unknown)=>{
          if(!record(ref)||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256)||ref.path!==`forecast-masks/geometries/${ref.sha256}.json.gz`||!Array.isArray(ref.pra_ids))throw Error('FORECAST_MASK_GEOMETRY_REF');
          let shard=shards.get(ref.sha256);
          if(!shard){
            const bytes=await forecastMaskObject(String(ref.path),8*1024**2);
            if(!bytes||bytes.length!==ref.bytes)throw Error('FORECAST_MASK_GEOMETRY_SIZE');
            shard=unpack(bytes,ref.sha256,budget);shards.set(ref.sha256,shard);
          }
          if(!record(shard)||shard.version!==FORECAST_MASK_VERSION||shard.type!=='FeatureCollection'||!Array.isArray(shard.features))throw Error('FORECAST_MASK_GEOMETRY_SCHEMA');
          const found=shard.features.map((f:unknown)=>record(f)?f.id:null).sort();
          if(JSON.stringify(found)!==JSON.stringify(ref.pra_ids))throw Error('FORECAST_MASK_GEOMETRY_PRA');
          return shard.features.map((f:unknown)=>{
            if(!record(f)||typeof f.id!=='string'||!record(f.properties)||!byId.has(f.id))throw Error('FORECAST_MASK_GEOMETRY_BINDING');
            return {...f,properties:{...f.properties,support_id:byId.get(f.id)!.support_id}};
          });
        }));
        features=groups.flat();
      }
      if(features.some(f=>!record(f)||f.type!=='Feature'||typeof f.id!=='string'||!record(f.properties)||typeof f.properties.code!=='string'||f.id!==`pra:${f.properties.code}`||typeof f.properties.support_id!=='string'||!record(f.geometry)||!['Polygon','MultiPolygon'].includes(String(f.geometry.type))))throw Error('FORECAST_MASK_GEOMETRY');
      if(new Set(features.map(f=>record(f)?f.id:undefined)).size!==features.length)throw Error('FORECAST_MASK_DUPLICATE_GEOMETRY');
      if(firstManifest){
        const ps=new Map(d.rows.map(p=>[p.pra_id,p]));
        for(const f of features as PraCollection['features']){
          const proof=ps.get(String(f.id));
          if(proof?.geometry_verified&&proof.support_id===f.properties.support_id)baseline.set(String(f.id),{proof,feature:f});
        }
        firstManifest=false;
      }
      proofs.push(...d.rows);
      collection.features.push(...features as PraCollection['features']);
    }
    collection=boundForecastGeometries(rows,proofs,collection,referenceSha);
    // No positive quality without the corresponding verified feature, even at >=90%.
    const ids=new Set(collection.features.map(f=>f.properties.support_id));
    const qualified=proofs.filter(p=>p.status==='absent'||!!p.support_id&&ids.has(p.support_id));
    const byKey=new Map(qualified.map(p=>[`${p.pra_id}/${p.variable}/${p.period}`,p]));
    const coveredIds=new Set(rows.flatMap(row=>{
      const proof=byKey.get(`${row.pra_id}/${row.variable}/${row.valid_date}`);
      return proof&&coveragePaint({value:row.value,quality:forecastSpatialQuality(row,proof,referenceSha),field:'value',geometrySupportId:proof.support_id??undefined}).target==='covered'?[proof.support_id]:[];
    }));
    collection.features=collection.features.filter(f=>coveredIds.has(f.properties.support_id!));
    return {proofs:qualified,referenceSha,collection,membershipRejections};
  } catch (error) {
    const reason=error instanceof Error&&/^FORECAST_MASK_[A-Z_]+$/.test(error.message)?error.message:'FORECAST_MASK_UNAVAILABLE';
    return {proofs:[] as ForecastSupport[],referenceSha:'',collection:empty(),reason};
  }
}
