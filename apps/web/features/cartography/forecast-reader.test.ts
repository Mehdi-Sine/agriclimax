import {afterEach, expect, it, vi} from 'vitest';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import identities from '../../data/operational/pra-identities.json';
import pilot from '../../data/operational/cycle.json';
import type {WeatherRow} from '../operational/model';
import {FORECAST_MASK_VERSION} from './forecast-support';
const remote=vi.hoisted(()=>vi.fn());
vi.mock('server-only',()=>({}));
vi.mock('../../lib/server/weather-archives',()=>({forecastMaskObject:remote}));
import {forecastMasks} from '../../lib/server/forecast-masks';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
afterEach(()=>{vi.unstubAllEnvs();remote.mockReset();});
const row:WeatherRow={...pilot.rows[0] as WeatherRow,pra_id:identities.ids[0],provenance_sha256:'b'.repeat(64),provenance:{...pilot.rows[0].provenance,checksum:'b'.repeat(64)},spatial_coverage:1,value:0,status:'available'};
function fixture(archive='a'.repeat(64),sharded=false){
  const ref=hash(readFileSync('../../config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json'));
  const metadata={version:FORECAST_MASK_VERSION,model:'ifs',run:row.model_run_at,period:row.valid_date,variable:row.variable,
    grid_version:row.grid_version,weights_sha256:'d'.repeat(64),reference_sha256:ref};
  const proofs=identities.ids.map(pra_id=>({...metadata,pra_id,pra_weights_sha256:row.weights_sha256,source_sha256:row.provenance_sha256,support_id:hash(Buffer.from(pra_id)),fraction:1,status:'demonstrated',geometry_verified:true}));
  const d={...metadata,rows:proofs,collection:{type:'FeatureCollection',features:proofs.map(p=>({type:'Feature',id:p.pra_id,
    properties:{code:p.pra_id.slice(4),name:'test',department_name:'test',region_name:'test',support_id:p.support_id},
    geometry:{type:'Polygon',coordinates:[[[1,45],[1.1,45],[1.1,45.1],[1,45]]]}}))}};
  const geometry=gzipSync(JSON.stringify({version:FORECAST_MASK_VERSION,type:'FeatureCollection',features:d.collection.features.map(f=>({...f,properties:{...f.properties,support_id:undefined}}))}));
  const geometrySha=hash(geometry),geometryPath=`forecast-masks/geometries/${geometrySha}.json.gz`;
  const document=sharded?{...d,collection:{type:'FeatureCollection',features:[]},geometry_entries:[{path:geometryPath,sha256:geometrySha,bytes:geometry.length,pra_ids:[...identities.ids].sort()}]}:d;
  const blob=gzipSync(JSON.stringify(document)),sha=hash(blob),path=`forecast-masks/blobs/${sha}.json.gz`;
  const index=gzipSync(JSON.stringify({version:FORECAST_MASK_VERSION,archive_sha256:archive,
    entries:[{...metadata,path,sha256:sha,bytes:blob.length}]}));
  const pin=hash(index);
  remote.mockImplementation(async(p:string)=>p.includes('/indexes/')?index:p===geometryPath?geometry:blob);
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256',pin);
  return {pin,path,blob,index,geometryPath};
}
it('is disabled by default without any storage read',async()=>{
  vi.stubEnv('COUV05_RENDER_ENABLED','false');
  expect(await forecastMasks([row],'a'.repeat(64))).toBeUndefined();expect(remote).not.toHaveBeenCalled();
});
it('reads exact pinned sidecars and returns only the selected row geometry',async()=>{
  fixture();const result=await forecastMasks([row],'a'.repeat(64));
  expect(result?.proofs).toHaveLength(1);expect(result?.collection.features).toHaveLength(0);
  expect(result?.proofs[0].pra_id).toBe(row.pra_id);expect(remote).toHaveBeenCalledTimes(2);
});
it('rejects archive mismatch and corruption without aggregate fallback',async()=>{
  fixture('d'.repeat(64));expect((await forecastMasks([row],'a'.repeat(64)))?.proofs).toHaveLength(0);
  fixture();remote.mockResolvedValue(Buffer.from('broken'));
  expect((await forecastMasks([row],'a'.repeat(64)))?.proofs).toHaveLength(0);
});
it('rejects another source provenance',async()=>{
  fixture();const result=await forecastMasks([{...row,provenance_sha256:'e'.repeat(64)}],'a'.repeat(64));
  expect(result?.proofs).toHaveLength(0);expect(result?.collection.features).toHaveLength(0);
});

it('binds support IDs after verifying deduplicated geometry shards',async()=>{
  fixture('a'.repeat(64),true);
  const result=await forecastMasks([row],'a'.repeat(64));
  expect(result?.proofs).toHaveLength(1);expect(remote).toHaveBeenCalledTimes(3);
});
it('rejects a missing geometry shard, including above 90 percent',async()=>{
  const f=fixture('a'.repeat(64),true);
  remote.mockImplementation(async(p:string)=>p===f.geometryPath?null:p.includes('/indexes/')?f.index:f.blob);
  expect((await forecastMasks([row],'a'.repeat(64)))?.proofs).toHaveLength(0);
});
it('reuses verified coordinates for composite inputs only with identical PRA memberships',async()=>{
  const {gunzipSync}=await import('node:zlib');
  for(const different of [false,true]){
    const f=fixture('a'.repeat(64),true),first=JSON.parse(gunzipSync(f.blob).toString());
    first.rows=first.rows.map((p:Record<string,unknown>)=>({...p,valid_cells:['cell:1','cell:2']}));
    const second={...first,variable:'humidity',rows:first.rows.map((p:Record<string,unknown>)=>({...p,variable:'humidity',support_id:hash(Buffer.from(String(p.pra_id)+'/humidity')),valid_cells:different?['cell:2','cell:3']:['cell:1','cell:2']})),
      geometry_entries:[{path:`forecast-masks/geometries/${'e'.repeat(64)}.json.gz`,sha256:'e'.repeat(64),bytes:100,pra_ids:[...identities.ids].sort()}]};
    const objects=new Map<string,Buffer>(),entries=[first,second].map(d=>{
      const blob=gzipSync(JSON.stringify(d)),sha=hash(blob),path=`forecast-masks/blobs/${sha}.json.gz`;objects.set(path,blob);
      return {version:d.version,model:d.model,run:d.run,period:d.period,variable:d.variable,grid_version:d.grid_version,weights_sha256:d.weights_sha256,reference_sha256:d.reference_sha256,path,sha256:sha,bytes:blob.length};
    });
    const geometry=await remote(f.geometryPath);objects.set(f.geometryPath,geometry);
    const index=gzipSync(JSON.stringify({version:FORECAST_MASK_VERSION,archive_sha256:'a'.repeat(64),entries}));
    vi.stubEnv('COUV05_INDEX_SHA256',hash(index));remote.mockClear();
    remote.mockImplementation(async(path:string)=>path.includes('/indexes/')?index:objects.get(path)??null);
    const result=await forecastMasks([row,{...row,variable:'humidity',unit:'%'}],'a'.repeat(64),{identicalMemberships:true});
    expect(result?.proofs).toHaveLength(different?1:2);
    expect(remote).toHaveBeenCalledTimes(4);
  }
});
