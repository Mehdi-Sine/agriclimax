import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('server-only',()=>({}));
import portfolio from '../../../../supabase/tests/wheat-portfolio.json';
import {readWheat,WheatRepository,wheatQuery} from './server';
import {WheatWorkspace} from './workspace';

const query='mode=wheat&start=2026-09-01&end=2026-09-03';
function setup(payload:unknown=[portfolio]) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY','synthetic-wheat-secret');
  vi.stubEnv('WHEAT_STORAGE','supabase');
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  const transport=vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));
  return {transport,repo:new WheatRepository(transport)};
}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.useRealTimers();});
describe('Wheat live portfolio boundary',()=>{
  it('reads explicit period and parameter fingerprint, ages persisted data without exposing the secret',async()=>{
    const {repo,transport}=setup();
    const response=await readWheat(new Request(`https://app.test/api/wheat?${query}`),repo);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body=await response.text();
    expect(body).not.toContain('synthetic-wheat-secret');
    expect(JSON.parse(body)).toMatchObject({mode:'wheat',risk_computed:false,data:[{
      spatial_support:'station_point',results:expect.arrayContaining([expect.objectContaining({value:18,confidence:'low',freshness:'stale',scientific_status:'exploratory'})]),
    }]});
    expect(transport.mock.calls[0][1]).toMatchObject({redirect:'error',cache:'no-store',
      body:JSON.stringify(wheatQuery(new URLSearchParams(query)))});
  });
  it.each(['mode=demo',`${query}&start=2026-09-02`,query.replace('2026-09-01','2026-02-30'),
    `${query}&station=invalid`,`${query}&fingerprint=latest`,`${query}&stage=predicted`,`${query}&unknown=1`])('rejects invalid context: %s',async q=>{
    const {repo,transport}=setup();
    expect((await readWheat(new Request(`https://app.test/api/wheat?${q}`),repo)).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  it('empty upstream stays empty without demo fallback',async()=>{
    const {repo}=setup([]);
    expect(await (await readWheat(new Request(`https://app.test/api/wheat?${query}`),repo)).json()).toMatchObject({data:[]});
  });
  it.each(['station','status','coverage','duplicate','period','date','fingerprint'])('rejects corrupt upstream %s',async kind=>{
    const p=structuredClone(portfolio);
    if(kind==='station') p.station_id='12345678';
    if(kind==='status') p.results[0].scientific_status='validated';
    if(kind==='coverage') p.results[0].available_days=2;
    if(kind==='duplicate') p.results[1].indicator=p.results[0].indicator;
    if(kind==='period') p.results[0].period.end='2026-09-02';
    if(kind==='date') p.computed_at='2099-01-01T00:00:00Z';
    if(kind==='fingerprint') p.parameter_fingerprint='b'.repeat(64);
    const {repo}=setup([p]);
    const station=kind==='station'?'&station=35281001':'';
    expect((await readWheat(new Request(`https://app.test/api/wheat?${query}${station}`),repo)).status).toBe(502);
  });
  it('renders station points, diagnostic sources, unavailable anomalies and exploratory limits',async()=>{
    const {transport}=setup();vi.stubGlobal('fetch',transport);
    const html=renderToStaticMarkup(await WheatWorkspace({params:new URLSearchParams(query),view:'observation'}));
    expect(html).toContain('<circle');expect(html).toContain('station');
    expect(html).toContain('Aucun risque agronomique complet');expect(html).toContain('Indisponible');
    expect(html).toContain('1991–2020');expect(html).toContain('wheat.gdd');
    expect(html).toContain('/diagnostic?mode=wheat');
  });
  it('shows absent and source error states',async()=>{
    const {transport}=setup([]);vi.stubGlobal('fetch',transport);
    const html=renderToStaticMarkup(await WheatWorkspace({params:new URLSearchParams(query),view:'diagnostic'}));
    expect(html).toContain('Aucun portefeuille publié');
    transport.mockRejectedValue(new Error('private upstream detail'));
    const error=renderToStaticMarkup(await WheatWorkspace({params:new URLSearchParams(query),view:'diagnostic'}));
    expect(error).toContain('Source indisponible');expect(error).not.toContain('private upstream detail');
  });
});
