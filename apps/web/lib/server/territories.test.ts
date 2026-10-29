import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readTerritories} from './territories';
const base='https://app.test/api/territories?reference=official-2017';
const row={id:'pra:01001',official_code:'01001',name:'Synthetic PRA',area_km2:10,department_code:'01',department_name:'Synthetic department',region_code:'84',region_name:'Synthetic region'};
function configure(){vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('SUPABASE_SECRET_KEY','synthetic-private-key');}
afterEach(()=>vi.unstubAllEnvs());
it('lookup retains leading zeros, hierarchy and bounded cursor without raw metadata',async()=>{
 configure();const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:[{...row,source_receipts:{private:'canary'}}],next_cursor:null}));
 const r=await readTerritories(new Request(base+'&department=01'),fetcher);expect(r.status).toBe(200);
 const text=await r.text();expect(text).toContain('01001');expect(text).not.toContain('source_receipts');expect(text).not.toContain('canary');
 expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:'error',cache:'no-store'});
});
it.each(['&limit=101','&limit=0','&reference=other','&unknown=x','&action=delete','&department=971','&action=read&date=2026-02-30&dataset=test&scope=france'])('rejects invalid query before transport %s',async suffix=>{
 const fetcher=vi.fn<typeof fetch>();expect((await readTerritories(new Request(base+suffix),fetcher)).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
});
it('missing PRA climate remains null/unavailable, distinct from station observations',async()=>{
 configure();const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({source_id:'era5-land',source_kind:'reanalysis',method_version:'pra-native-1',data:[{...row,temperature:null,temperature_min:null,temperature_max:null,precipitation:null,coverage:null,valid_counts:null,expected_cells:null,status:'unavailable',freshness:'stale',computed_at:null,valid_date:null,batch_key:null,quality_flags:null}],next_cursor:null}));
 const r=await readTerritories(new Request(base+'&action=read&dataset=test&date=2026-01-01&scope=pra&id=pra:01001'),fetcher);
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({source_kind:'reanalysis',data:[{temperature:null,status:'unavailable'}]});
});
it('rejects duplicates and malformed upstream data',async()=>{
 configure();for(const data of [[row,row],[{...row,area_km2:-1}],[{...row,id:'station123'}]]) {
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data,next_cursor:null}));expect((await readTerritories(new Request(base),fetcher)).status).toBe(502);}
});
it('never exposes upstream error details or credentials',async()=>{
 configure();const fetcher=vi.fn<typeof fetch>().mockRejectedValue(new Error('synthetic-private-key'));
 const r=await readTerritories(new Request(base),fetcher);expect(r.status).toBe(502);expect(await r.text()).not.toContain('synthetic-private-key');
});
it('reads complete territorial data and rejects a false full-coverage label',async()=>{
 configure();
 const full={...row,temperature:10,temperature_min:5,temperature_max:15,precipitation:2,coverage:[1,1,1,1],valid_counts:[4,4,4,4],expected_cells:4,status:'available',freshness:'stale',computed_at:'2026-01-02T00:00:00Z',valid_date:'2026-01-01',batch_key:'a'.repeat(64),quality_flags:[]};
 const address=base+'&action=read&dataset=test&date=2026-01-01&scope=pra&id=pra:01001';
 for(const [data,status] of [[full,200],[{...full,coverage:[0.5,1,1,1]},502]] as const) {
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({source_id:'era5-land',source_kind:'reanalysis',method_version:'pra-native-1',data:[data],next_cursor:null}));
 expect((await readTerritories(new Request(address),fetcher)).status).toBe(status);
 }
});

it('reports a published batch with no native values as unavailable, retaining missing-source evidence',async()=>{
 configure();const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({source_id:'era5-land',source_kind:'reanalysis',method_version:'pra-native-1',data:[{...row,temperature:null,temperature_min:null,temperature_max:null,precipitation:null,coverage:[0,0,0,0],valid_counts:[0,0,0,0],expected_cells:6,status:'partial',freshness:'stale',computed_at:'2026-01-02T00:00:00Z',valid_date:'2026-01-01',batch_key:'a'.repeat(64),quality_flags:['missing_cells']}],next_cursor:null}));
 const response=await readTerritories(new Request(base+'&action=read&dataset=test&date=2026-01-01&scope=pra&id=pra:01001'),fetcher);
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({state:'unavailable',data:[{status:'unavailable',temperature:null,expected_cells:6,coverage:[0,0,0,0],valid_counts:[0,0,0,0],quality_flags:['missing_cells']}]});
});

it('pilot pagination filters reference-only PRA and keeps the explicit 73/713 scope',async()=>{
 configure();
 const sample=(await import('../../../../config/pilots/pra73-v1.json')).default;
 const selected=sample.selection.map(item=>({...row,id:item.id,official_code:item.code,name:item.name}));
 const outside={...row,id:'pra:01000',official_code:'01000'};
 const fetcher=vi.fn<typeof fetch>()
  .mockResolvedValueOnce(Response.json({data:[outside,...selected.slice(0,30)].sort((a,b)=>a.id.localeCompare(b.id)),next_cursor:selected[29].id}))
  .mockResolvedValueOnce(Response.json({data:selected.slice(30),next_cursor:null}));
 const address=`https://app.test/api/territories?reference=${sample.reference_version}&pilot=73&limit=73`;
 const response=await readTerritories(new Request(address),fetcher);
 expect(response.status).toBe(200);
 const result=await response.json();expect(result.data).toHaveLength(73);expect(result.data.map((item:{id:string})=>item.id)).toEqual(selected.map(item=>item.id));
 expect(result.pilot).toMatchObject({selected_count:73,total_reference_count:713});expect(result.next_cursor).toBeNull();
 expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(['&pilot=713','&pilot=73&pilot=73','&pilot=73&limit=74'])('rejects an unbounded or ambiguous pilot request %s',async suffix=>{
 const sample=(await import('../../../../config/pilots/pra73-v1.json')).default;
 const fetcher=vi.fn<typeof fetch>();
 const response=await readTerritories(new Request(`https://app.test/api/territories?reference=${sample.reference_version}${suffix}`),fetcher);
 expect(response.status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
});

it('does not label a partially imported pilot complete when returned weather rows are valid',async()=>{
 configure();const sample=(await import('../../../../config/pilots/pra73-v1.json')).default;
 const first=sample.selection[0];
 const full={...row,id:first.id,temperature:10,temperature_min:5,temperature_max:15,precipitation:2,coverage:[1,1,1,1],valid_counts:[1,1,1,1],expected_cells:1,status:'available',freshness:'stale',computed_at:'2026-10-29T00:00:00Z',valid_date:'2026-10-18',batch_key:'a'.repeat(64),quality_flags:[]};
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({source_id:'era5-land',source_kind:'reanalysis',method_version:'pra-native-1',data:[full],next_cursor:null}));
 const response=await readTerritories(new Request(`https://app.test/api/territories?reference=${sample.reference_version}&action=read&pilot=73&limit=73&dataset=era5land-pilot73-20261012-20261018-v1&date=2026-10-18&scope=france`),fetcher);
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({state:'partial',pilot:{selected_count:73},data:[{status:'available'}]});
});
