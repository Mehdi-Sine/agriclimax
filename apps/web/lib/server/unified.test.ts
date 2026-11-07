vi.mock("./coastal-complement", () => ({ coastalComplement: vi.fn().mockResolvedValue(undefined) }));
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only',()=>({}));
vi.mock('./spatial-restitution',()=>({observedSupportDay:vi.fn().mockResolvedValue({verified:false,rows:[],geometries:{},identity:'unavailable'})}));
import { parseContextRow, readNational } from './national';
import { unifiedData } from './unified';
import { DAYS } from '../../features/national/model';
const base={current_value:12,normal_1991_2020:10,anomaly:2,sample_years:30,expected_years:30,reference_coverage:1,current_coverage:[0.7,0.8,0.9,1],current_status:'partial',status:'available',normal_status:'available'};
afterEach(()=>vi.unstubAllEnvs());
function configure(){vi.stubEnv('PRA_NATIONAL_ENABLED','1');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('SUPABASE_SECRET_KEY','test-private');}
it('matches the deployed SQL array contract and its variable ordering',()=>{
 const sql=readFileSync('../../supabase/migrations/20261102064147_pra_climatology_superseded_release_guard.sql','utf8');
 expect(sql).toContain("'current_coverage',c.coverage");
 const pipeline=readFileSync('../../engine/src/agriclimax/territories/pipeline.py','utf8');
 expect(pipeline).toContain('VARIABLES = ("temperature", "temperature_min", "temperature_max", "precipitation")');
 expect(sql).toContain("(0,'temperature_min'");expect(sql).toContain("(1,'temperature_max'");expect(sql).toContain("(2,'temperature'");
 for(const [variable,expected] of [['temperature_min',0.8],['temperature_max',0.9],['temperature',0.7],['precipitation',1]] as const)expect(parseContextRow({...base,variable}).current_coverage).toBe(expected);
 expect(parseContextRow({...base,variable:'temperature',current_coverage:1}).current_coverage).toBe(1);
 expect(()=>parseContextRow({...base,variable:'temperature',current_coverage:[1,2,1,1]})).toThrow();
});
it('accepts the actual 120-row historical response and preserves unavailable and leap-day NULLs',async()=>{
 configure();
 const f=vi.fn<typeof fetch>().mockResolvedValue(Response.json({status:'available',data:DAYS.flatMap(date=>['temperature_min','temperature_max','temperature','precipitation'].map(variable=>({...base,date,variable})))}));
 const result=await readNational(new Request('https://test/api/national?action=context-history&pra=pra:01451'),f);
 expect(result.status).toBe(200);const data=await result.json();expect(data.data).toHaveLength(120);expect(data.data[2].current_coverage).toBe(0.7);
 const leap=parseContextRow({...base,date:'2024-02-29',variable:'temperature',current_value:null,normal_1991_2020:null,anomaly:null,current_coverage:null,sample_years:8,reference_coverage:8/30,status:'missing_current',normal_status:'leap_day_insufficient_reference'});
 expect(leap.normal_1991_2020).toBeNull();expect(leap.normal_status).toBe('leap_day_insufficient_reference');
 expect(JSON.stringify(data)).not.toContain('test-private');
});
it('rejects a duplicate date/variable history rather than losing a day silently',async()=>{
 configure();const f=vi.fn<typeof fetch>().mockResolvedValue(Response.json({status:'available',data:Array.from({length:120},()=>({...base,date:DAYS[0],variable:'temperature'}))}));
 expect((await readNational(new Request('https://test/api/national?action=context-history&pra=pra:01451'),f)).status).toBe(502);
});
it('aggregates two real-contract paginated national dates into 713 bounded DTOs',async()=>{
 configure();
 const f=vi.fn<typeof fetch>().mockImplementation(async(_url,options)=>{
 const p=JSON.parse(String(options?.body));const after=p.p_after?Number(p.p_after.slice(4)):0,count=Math.min(100,713-after);
 return Response.json({status:'available',data:Array.from({length:count},(_,i)=>({...base,current_status:'available',current_coverage:1,current_value:p.p_date==='2026-10-17'?2:3,normal_1991_2020:1,pra_id:`pra:${String(after+i+1).padStart(5,'0')}`})),next_cursor:after+count<713?`pra:${String(after+count).padStart(5,'0')}`:null});
 });
 const result=await unifiedData(new URLSearchParams({start:'2026-10-17',end:'2026-10-18',indicator:'rain'}),f);
 expect(result.data).toHaveLength(713);expect(result.data[0]).toMatchObject({value:5,normal:2,anomaly:3,status:'available',expectedDays:2});expect(f).toHaveBeenCalledTimes(16);
});
it('rejects invalid ranges before upstream reads',async()=>{
 configure();const f=vi.fn<typeof fetch>();
 for(const query of ['start=2026-10-18&end=2026-09-19&indicator=rain','start=2026-09-18&end=2026-10-18&indicator=rain','start=2026-10-18&end=2026-10-18&indicator=hot&threshold=NaN'])await expect(unifiedData(new URLSearchParams(query),f)).rejects.toMatchObject({status:400});
 expect(f).not.toHaveBeenCalled();
});
