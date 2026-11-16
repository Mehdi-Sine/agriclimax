import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
it('resolves an exact frozen forecast pin from the catalogue after current advances',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://storage.example');vi.stubEnv('SUPABASE_SECRET_KEY','test-only');
  const sha='a'.repeat(64),entry={path:`weather/${sha}.json.gz`,sha256:sha,bytes:3,dates:['2026-11-15'],run_date:'2026-11-14',method_version:'pra-national-weather-daily-1'};
  const calls:string[]=[];
  vi.stubGlobal('fetch',async(input:string|URL)=>{const url=String(input);calls.push(url);return url.endsWith('/catalogue.json')?Response.json({version:'pra-archive-catalogue-1',weather:[entry],era5:[]}):new Response(new Uint8Array([1,2,3]));});
  const {nationalWeatherDocument}=await import('./weather-archives');
  await expect(nationalWeatherDocument(undefined,sha)).rejects.toThrow('ARCHIVE_CHECKSUM');
  expect(calls).toHaveLength(2);expect(calls[0]).toMatch(/catalogue.json$/);expect(calls[1]).toMatch(new RegExp(`/weather/${sha}.json.gz$`));
});
it('never substitutes current for a missing exact pin',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://storage.example');vi.stubEnv('SUPABASE_SECRET_KEY','test-only');
  const fetcher=vi.fn(async()=>Response.json({version:'pra-archive-catalogue-1',weather:[],era5:[]}));vi.stubGlobal('fetch',fetcher);
  const {nationalWeatherDocument}=await import('./weather-archives');
  expect(await nationalWeatherDocument(undefined,'a'.repeat(64))).toBeNull();expect(fetcher).toHaveBeenCalledTimes(1);
});
