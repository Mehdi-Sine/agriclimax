import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('./weather-archives',()=>({
 currentManifest:async()=>({era5_dates:['2026-10-31']}),
 archiveCatalogue:async()=>({era5:[{dates:['2026-10-31']}]}),
 archivedEra5Day:async(date:string)=>date==='2026-10-31'?[{pra_id:'pra:50081',temperature:12,temperature_min:8,temperature_max:16,precipitation:2,coverage:[.44,.44,.44,.44],status:'partial'}]:null,
}));
import {nationalData} from './national';
import {calendarDays} from '../../features/national/daily-availability';
import {NATIONAL} from '../../features/national/model';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('restores the requested PRA into cold history rows whose SQL contract omits pra_id',async()=>{
 vi.stubEnv('PRA_NATIONAL_ENABLED','1');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('SUPABASE_SECRET_KEY','test');
 const f=vi.fn<typeof fetch>().mockImplementation(async(url)=>{
  if(String(url).endsWith('agriclimax_pra_daily_catalog'))return Response.json({source_id:'era5-land',dataset_version:NATIONAL.dataset,latest:'2026-10-30',source_date:'2026-10-30',days:calendarDays('2026-10-01','2026-10-30'),acquired_at:null,updated_at:null,acquisition_time_status:'unknown'});
  return Response.json({status:'available',data:calendarDays('2026-10-02','2026-10-31').flatMap(date=>['temperature','temperature_min','temperature_max','precipitation'].map(variable=>({date,variable,current_value:date==='2026-10-31'?null:10,normal_1991_2020:10,anomaly:date==='2026-10-31'?null:0,sample_years:30,expected_years:30,reference_coverage:1,current_coverage:date==='2026-10-31'?null:1,current_status:date==='2026-10-31'?null:'available',status:date==='2026-10-31'?'missing_current':'available',normal_status:'available'})))});
 });vi.stubGlobal('fetch',f);
 const result=await nationalData(new URLSearchParams('action=context-history&pra=pra:50081&end=2026-10-31'));
 expect(result.data).toHaveLength(120);const rows=result.data as {date:string;variable:string;current_value:number|null}[];
 expect(rows.find(r=>r.date==='2026-10-31'&&r.variable==='temperature')?.current_value).toBe(12);
 expect(rows.find(r=>r.date==='2026-10-31'&&r.variable==='precipitation')?.current_value).toBe(2);
});
