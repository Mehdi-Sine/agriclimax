import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { nationalAvailability } from './national-availability';
import { NATIONAL } from '../../features/national/model';
import { calendarDays } from '../../features/national/daily-availability';
afterEach(()=>vi.unstubAllEnvs());
function fixture(){
 vi.stubEnv('PRA_NATIONAL_ENABLED','1');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('SUPABASE_SECRET_KEY','synthetic-private');
 return {source_id:'era5-land',dataset_version:NATIONAL.dataset,latest:'2026-10-30',source_date:'2026-10-30',days:calendarDays('2026-10-01','2026-10-30'),acquired_at:'2026-11-02T10:00:00Z',updated_at:'2026-11-04T10:00:00Z',acquisition_time_status:'known'};
}
it('uses actual persisted metadata, preserves archive URLs, and distinguishes all three dates',async()=>{
 const value=fixture();const f=vi.fn<typeof fetch>().mockResolvedValue(Response.json(value));
 const result=await nationalAvailability(f);
 expect(result).toMatchObject({latest:value.latest,acquired_at:value.acquired_at,updated_at:value.updated_at});
 expect(result.days).toContain('2026-09-19');expect(result.days).not.toContain('2026-11-05');expect(f).toHaveBeenCalledTimes(1);
 expect(JSON.stringify(result)).not.toContain('synthetic-private');
});
it('does not accept a missing or malformed catalog as available data',async()=>{
 const value=fixture();
 for(const bad of [{...value,latest:null},{...value,days:value.days.slice(1)},{...value,acquired_at:null},{...value,source_id:'meteofrance'}])await expect(nationalAvailability(vi.fn<typeof fetch>().mockResolvedValue(Response.json(bad)))).rejects.toMatchObject({status:502});
});
