import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readPraDiagnostics} from './pra-diagnostics';
const url='https://app.test/api/territories/diagnostics?reference=official&dataset=test&pra=pra:01001&start=2026-01-01&end=2026-01-01&parameters='+'a'.repeat(64);
const row={indicator_id:'wheat.gdd',rule_version:'wheat-climate-1',unit:'degC day',start_date:'2026-01-01',end_date:'2026-01-01',value:10,coverage:1,valid_cells:1,expected_cells:1,batch_key:'b'.repeat(64),spatial_method:'area_weighted_mean_of_native_indicator'};
afterEach(()=>vi.unstubAllEnvs());
it('serves existing descriptive indicators with compact provenance and no risk claim',async()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('SUPABASE_SECRET_KEY','synthetic-secret');
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({source_id:'era5-land',source_kind:'reanalysis',scientific_status:'exploratory',risk_computed:false,data:[{...row,payload:'private-canary'}]}));
 const r=await readPraDiagnostics(new Request(url),fetcher);expect(r.status).toBe(200);const text=await r.text();expect(text).not.toContain('private-canary');expect(JSON.parse(text)).toMatchObject({risk_computed:false,data:[{value:10,rule_version:'wheat-climate-1'}]});
});
it.each(['&unknown=1','&start=2026-02-30','&parameters=bad'])('rejects invalid selection %s',async suffix=>{
 const fetcher=vi.fn<typeof fetch>();expect((await readPraDiagnostics(new Request(url+suffix),fetcher)).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
});
