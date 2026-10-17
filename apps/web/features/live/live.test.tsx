import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only',()=>({}));
import publication from '../../../../tests/e2e/daily-publication.synthetic.json';
import { isLiveWorkspace, liveContext, liveHref, latestHref } from './context';
import { loadLive } from './load';
import { LiveWorkspace } from './workspace';
const query = 'mode=live_meteofrance&production=wheat&indicator=gdd&start=2026-09-01&end=2026-09-03&station=35281001';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function setup(payload:unknown={latest:publication,selected:publication}) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY','test-only-private-key');
  // This setting must never enable snapshot reads in the unified live workspace.
  vi.stubEnv('WHEAT_STORAGE','snapshots');
  const transport=vi.fn<typeof fetch>().mockImplementation(async input => Response.json(String(input).endsWith('agriclimax_weather_stations') ? [] : payload));
  vi.stubGlobal('fetch',transport);
  return transport;
}
describe('Live context and real-result boundary',()=>{
  it('changes only the window when requesting the latest publication in the same view',()=>{
    const params=new URLSearchParams(`${query}&stage=anthese&fingerprint=${'a'.repeat(64)}`);
    const url=new URL(latestHref('history',params),'https://app.test');
    expect(url.pathname).toBe('/history');
    expect(url.searchParams.has('start')).toBe(false);
    expect(url.searchParams.has('end')).toBe(false);
    for(const key of ['station','production','indicator','stage','fingerprint']) expect(url.searchParams.get(key)).toBe(params.get(key));
  });
  it('requires a deliberate station selection and reports configuration failures without details',async()=>{
    setup();
    const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams('production=cattle'),view:'observation'}));
    expect(html).toContain('Aucune station n’est choisie automatiquement');
    expect(html).not.toContain('aria-current="true"');
    vi.stubEnv('SUPABASE_SECRET_KEY','');
    const unavailable=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(query),view:'diagnostic'}));
    expect(unavailable).toContain('n’est pas configuré');
    expect(unavailable).not.toContain('SUPABASE_SECRET_KEY');
  });
  it('defaults to real indicators while preserving explicit demo, snapshots and versioned risk routes',()=>{
    expect(isLiveWorkspace(new URLSearchParams())).toBe(true);
    expect(isLiveWorkspace(new URLSearchParams('mode=live_meteofrance&production=cattle'))).toBe(true);
    for(const query of ['mode=demo','mode=wheat','mode=live&rule=versioned-risk&version=1']) expect(isLiveWorkspace(new URLSearchParams(query))).toBe(false);
  });
  it('preserves station, metric, window and parameters across all views',()=>{
    const context=liveContext(new URLSearchParams(`${query}&stage=anthese`));
    for (const view of ['observation','diagnostic','history','watch'] as const) {
      const url=new URL(liveHref(view,context.query),'https://app.test');
      expect(url.searchParams.get('station')).toBe('35281001');
      expect(url.searchParams.get('indicator')).toBe('gdd');
      expect(url.searchParams.get('end')).toBe('2026-09-03');
      expect(url.searchParams.get('stage')).toBe('anthese');
    }
  });
  it.each(['production=other','indicator=thi','start=2026-02-30','station=x','end=2099-01-01','start=2024-01-01','stage=inferred','fingerprint=latest'])('rejects invalid scientific context without a source call: %s', async change=>{
    const transport=setup();const params=new URLSearchParams(query);const [key,value]=change.split('=');params.set(key,value);
    expect((await loadLive(liveContext(params))).failure).toContain('Contexte invalide');
    expect(transport).not.toHaveBeenCalled();
  });
  it('uses persisted results regardless of the snapshot setting and maps the selected metric',async()=>{
    const transport=setup();
    const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(query.replace('indicator=gdd','indicator=precipitation_sum')),view:'observation'}));
    expect(transport.mock.calls.some(([url])=>String(url).endsWith('agriclimax_read_daily'))).toBe(true);
    expect(html).toContain('Cumul de précipitations');
    expect(html).toContain('Source : Météo-France');
    expect(html).toContain('stale');expect(html).toContain('exploratory');expect(html).toContain('/history?');
    expect(html).not.toContain('test-only-private-key');
  });
  it('does not replace empty or failed live sources with known snapshot values',async()=>{
    const transport=setup({latest:null,selected:null});
    const context=liveContext(new URLSearchParams(query));
    expect((await loadLive(context)).portfolios).toEqual([]);
    transport.mockRejectedValue(new Error('private exception'));
    const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(query),view:'diagnostic'}));
    expect(html).toContain('Aucun instantané ni fixture');
    expect(html).not.toContain('private exception');expect(html).not.toContain('wheat.gdd');
  });
  it('keeps an explicitly selected station absent instead of selecting the first result',async()=>{
    setup();
    const params=new URLSearchParams(query);params.set('station','99999999');
    const html=renderToStaticMarkup(await LiveWorkspace({params,view:'history'}));
    expect(html).toContain('Historique absent');expect(html).toContain('Aucun calcul publié');
    expect(html).not.toContain('Date du calcul');
  });
});

describe('Daily publication lifecycle',()=>{
  it('defaults both productions to the latest successful exact window without reading raw observations',async()=>{
    const transport=setup();
    for(const production of ['wheat','cattle']) {
      const context=liveContext(new URLSearchParams(`production=${production}&station=35281001`));
      const data=await loadLive(context);
      expect(context.start).toBe(publication.payload.from);
      expect(context.end).toBe(publication.payload.to);
      expect(data.latest?.key).toBe(publication.content_key);
      expect(production==='wheat'?data.portfolios.length:data.cattle?.results.length).toBe(1);
    }
    expect(transport.mock.calls.every(([url,options])=>String(url).endsWith('agriclimax_read_daily') && options?.cache==='no-store')).toBe(true);
  });
  it('retains an aged successful publication after a later failed run for all views and productions',async()=>{
    setup();
    for(const production of ['wheat','cattle']) for(const view of ['observation','diagnostic','history','watch'] as const) {
      const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(query.replace('production=wheat',`production=${production}`).replace('indicator=gdd',`indicator=${production==='cattle'?'thi':'gdd'}`)),view}));
      expect(html).toContain('Dernière publication quotidienne réussie');
      expect(html).toContain(publication.payload.computed_at);
      expect(html).toContain('ancienne (stale)');
      expect(html).toContain('État du dernier run quotidien : inconnu');
      expect(html).not.toContain('Aucun calcul publié');
    }
  });
  it('keeps a missing historical window absent even with a successful latest publication',async()=>{
    setup({latest:publication,selected:null});
    const html=renderToStaticMarkup(await LiveWorkspace({params:new URLSearchParams(query),view:'history'}));
    expect(html).toContain('Aucun calcul publié');
    expect(html).toContain('Dernière publication quotidienne réussie');
  });
  it('never substitutes daily synthetic THI for an explicit hourly request',async()=>{
    setup();
    const data=await loadLive(liveContext(new URLSearchParams(query.replace('production=wheat&indicator=gdd','production=cattle&indicator=thi')+'&product=observations')));
    expect(data.cattle).toBeNull();expect(data.latest).not.toBeNull();
  });
  it.each(['unpaired','bad-cattle','bad-period','demo','malformed'])('rejects corrupt publications without fallback: %s',async mutation=>{
    const broken=structuredClone(publication);
    if(mutation==='unpaired') broken.payload.cattle=[];
    if(mutation==='bad-cattle') broken.payload.cattle[0].daily=[];
    if(mutation==='bad-period') broken.payload.to='2026-09-04';
    if(mutation==='demo') broken.payload.cattle[0].provenance[0].demo=true;
    setup(mutation==='malformed'?{}:{latest:broken,selected:broken});
    const data=await loadLive(liveContext(new URLSearchParams(query)));
    expect(data.failure).toContain('indisponible');expect(data.portfolios).toEqual([]);expect(data.cattle).toBeNull();
  });
});
